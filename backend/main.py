import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ingestion import load_and_ingest
from retrieval import Retriever
from graph import build_knowledge_graph, export_graph_for_viz
from critique import answer_query

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


@app.on_event("startup")
def startup():
    ingested = load_and_ingest(DATA_DIR)
    STATE["clean_chunks"] = ingested["clean_chunks"]
    STATE["quarantined"] = ingested["quarantined"]
    STATE["retriever"] = Retriever(ingested["clean_chunks"])
    STATE["rules"] = build_knowledge_graph(ingested["clean_chunks"])
    print(
        f"[startup] {len(ingested['clean_chunks'])} clean chunks, "
        f"{len(ingested['quarantined'])} quarantined, "
        f"{len(STATE['rules'])} rules extracted"
    )


class QueryRequest(BaseModel):
    query: str


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
            src, {"filename": src, "tier": c.get("tier", "B"), "chunk_count": 0}
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


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
