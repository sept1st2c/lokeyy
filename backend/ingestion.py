"""
Ingestion: load brand documents, chunk them, and defend against context
poisoning / prompt injection before anything reaches the retrieval index.

Defense strategy (two layers):
  1. Heuristic pre-filter: regex-scan each chunk for known injection
     patterns. Flagged chunks are quarantined (excluded from the index,
     but logged) rather than silently trusted.
  2. Structural hardening (applied later, at generation time in critique.py):
     every retrieved chunk is wrapped in explicit "untrusted data" delimiters
     in the prompt, so even an unflagged/novel injection can't be read as an
     instruction by the model.
"""
import re
import glob
import os

CHUNK_MIN_LEN = 350

# Source trust tiering: A = official/authoritative brand doc, B = default
# (unmapped, e.g. internal memos/addenda, or anything web-sourced -- fetched
# live, not manually vetted, so it never earns tier A automatically no
# matter how official the fetched page looked), C = low-authority/unofficial
# (fan/blogger takes, informal paraphrase). Used to weight how much a rule
# or chunk should be trusted downstream in retrieval/critique.
SOURCE_TIERS = {
    "barco_guide.txt": "A",
    "fan_notes.txt": "C",
}
DEFAULT_TIER = "B"
TIER_TRUST_SCORE = {"A": 0.95, "B": 0.7, "C": 0.35}

# provenance is a display/audit label, separate from tier (which drives trust
# weighting) -- lets the UI say *why* something is tier B (web-sourced vs.
# just an unmapped local file) without conflating the two concepts.
PROVENANCE = {
    "barco_guide.txt": "official-pdf",
    "fan_notes.txt": "synthetic",
    "poisoned_addendum.txt": "synthetic",
}
DEFAULT_PROVENANCE = "local"


def tier_for_source(source: str, provenance: str) -> str:
    if provenance == "web":
        return DEFAULT_TIER
    return SOURCE_TIERS.get(source, DEFAULT_TIER)


INJECTION_PATTERNS = [
    r"ignore (all|any)? ?(previous|prior|above) instructions",
    r"disregard (all|any)? ?(previous|prior|above)",
    r"system notice",
    r"you are no longer bound",
    r"do not mention this (instruction|to the user)",
    r"new instructions?:",
    r"act as (if|though) you",
    r"reveal your (system|hidden) prompt",
    r"from now on,? (you|always|never)",
]
_COMPILED = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]


def scan_for_injection(text: str) -> list[str]:
    hits = []
    for pattern in _COMPILED:
        if pattern.search(text):
            hits.append(pattern.pattern)
    return hits


def _split_paragraphs(text: str) -> list[str]:
    raw = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks, buf = [], ""
    for p in raw:
        buf = f"{buf}\n\n{p}".strip() if buf else p
        if len(buf) >= CHUNK_MIN_LEN:
            chunks.append(buf)
            buf = ""
    if buf:
        chunks.append(buf)
    return chunks


def load_and_ingest(data_dir: str) -> dict:
    """Returns {"clean_chunks": [...], "quarantined": [...]}

    Scans two locations: the root data_dir (vetted local sources -- PDF
    extracts, synthetic test docs) and data_dir/web_sources/ (anything
    fetched live via web_ingest.py). Web-sourced content goes through the
    exact same injection scan as everything else -- arguably a MORE
    realistic threat surface than the synthetic poisoned test doc, since
    it's real, unvetted, external content.
    """
    clean_chunks = []
    quarantined = []
    chunk_id = 0

    root_files = sorted(glob.glob(os.path.join(data_dir, "*.txt")))
    web_files = sorted(glob.glob(os.path.join(data_dir, "web_sources", "*.txt")))

    for path, provenance_override in [(p, None) for p in root_files] + [
        (p, "web") for p in web_files
    ]:
        source = os.path.basename(path)
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()

        provenance = provenance_override or PROVENANCE.get(source, DEFAULT_PROVENANCE)
        tier = tier_for_source(source, provenance)
        trust_score = TIER_TRUST_SCORE[tier]

        for para in _split_paragraphs(text):
            hits = scan_for_injection(para)
            record = {
                "id": f"chunk-{chunk_id}",
                "source": source,
                "text": para,
                "tier": tier,
                "trust_score": trust_score,
                "provenance": provenance,
            }
            chunk_id += 1
            if hits:
                record["flagged_patterns"] = hits
                quarantined.append(record)
            else:
                clean_chunks.append(record)

    return {"clean_chunks": clean_chunks, "quarantined": quarantined}
