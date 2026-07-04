import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ingestion import load_and_ingest
from retrieval import HybridRetriever
from graph import build_knowledge_graph, export_graph_for_viz, CACHE_PATH
from critique import answer_query
from web_ingest import save_web_source, clear_web_sources, WebIngestError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

app = FastAPI(title="LOCI - Cognition & Brand Memory Engine")

# frontend-react runs on its own Vite dev server (localhost:5173) and either
# proxies /api/* to this server or calls it directly -- allow both local
# frontends during the demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATE: dict = {}


def _ingest_and_rebuild(force_graph_rebuild: bool = False):
    """Shared by startup and the web-source add/clear endpoints -- re-reads
    every source (root + web_sources/), rebuilds the BM25+embedding index,
    and rebuilds (or reloads the cached) knowledge graph. force_graph_rebuild
    deletes the cache first -- required whenever the corpus actually changed,
    since build_knowledge_graph otherwise trusts a stale cache unconditionally.
    """
    if force_graph_rebuild and os.path.exists(CACHE_PATH):
        os.remove(CACHE_PATH)

    ingested = load_and_ingest(DATA_DIR)
    STATE["clean_chunks"] = ingested["clean_chunks"]
    STATE["quarantined"] = ingested["quarantined"]
    STATE["retriever"] = HybridRetriever(ingested["clean_chunks"])
    STATE["rules"] = build_knowledge_graph(ingested["clean_chunks"])
    print(
        f"[ingest] {len(ingested['clean_chunks'])} clean chunks, "
        f"{len(ingested['quarantined'])} quarantined, "
        f"{len(STATE['rules'])} rules extracted"
    )


@app.on_event("startup")
def startup():
    _ingest_and_rebuild()


class QueryRequest(BaseModel):
    query: str


class WebSourceRequest(BaseModel):
    brand: str


@app.get("/api/status")
def status():
    # Sources with any quarantined content are attack/test documents, not
    # trusted brand sources -- their existence is already surfaced via the
    # "N injection attempts neutralized" badge, so don't also list them here
    # with a "verified/uploaded" checkmark, which would read as a
    # contradiction (a flagged attack doc being shown as trusted).
    quarantined_sources = {q["source"] for q in STATE["quarantined"]}

    sources: dict = {}
    for c in STATE["clean_chunks"]:
        src = c["source"]
        if src in quarantined_sources:
            continue
        entry = sources.setdefault(
            src,
            {
                "filename": src,
                "tier": c.get("tier", "B"),
                "provenance": c.get("provenance", "local"),
                "chunk_count": 0,
            },
        )
        entry["chunk_count"] += 1

    return {
        "clean_chunks": len(STATE["clean_chunks"]),
        "quarantined": STATE["quarantined"],
        "rules_count": len(STATE["rules"]),
        "sources": list(sources.values()),
    }


@app.get("/api/rules")
def rules():
    return {"rules": STATE["rules"]}


@app.get("/api/graph")
def graph():
    return export_graph_for_viz()


@app.post("/api/query")
def query(req: QueryRequest):
    return answer_query(req.query, STATE["retriever"], STATE["rules"])


@app.post("/api/sources/web")
def add_web_source(req: WebSourceRequest):
    """Search the web for a brand's voice/tone guidance, fetch a real page,
    save it (tier B, provenance "web"), and rebuild the index + graph.
    Slow (web search + fetch + one graph-extraction LLM call) -- expect
    10-60s. Persists across restarts; use DELETE to clear it."""
    try:
        result = save_web_source(req.brand)
    except WebIngestError as e:
        raise HTTPException(status_code=422, detail=str(e))

    _ingest_and_rebuild(force_graph_rebuild=True)
    return {
        "added": result["filename"],
        "fetched_url": result["fetched_url"],
        "status": status(),
    }


@app.delete("/api/sources/web")
def delete_web_sources():
    """Explicit, user-triggered purge of every web-sourced document --
    persistence is the default (see save_web_source), this is the opt-in
    cleanup rather than a silent auto-delete on some notion of 'session end'."""
    removed = clear_web_sources()
    _ingest_and_rebuild(force_graph_rebuild=removed > 0)
    return {"removed": removed, "status": status()}


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
