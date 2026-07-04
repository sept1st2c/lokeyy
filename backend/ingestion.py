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
# (unmapped, e.g. internal memos/addenda), C = low-authority/unofficial
# (fan/blogger takes, informal paraphrase). Used to weight how much a rule
# or chunk should be trusted downstream in retrieval/critique.
SOURCE_TIERS = {
    "barco_guide.txt": "A",
    "fan_notes.txt": "C",
}
DEFAULT_TIER = "B"
TIER_TRUST_SCORE = {"A": 0.95, "B": 0.7, "C": 0.35}


def tier_for_source(source: str) -> str:
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
    """Returns {"clean_chunks": [...], "quarantined": [...]} """
    clean_chunks = []
    quarantined = []
    chunk_id = 0

    for path in sorted(glob.glob(os.path.join(data_dir, "*.txt"))):
        source = os.path.basename(path)
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()

        tier = tier_for_source(source)
        trust_score = TIER_TRUST_SCORE[tier]

        for para in _split_paragraphs(text):
            hits = scan_for_injection(para)
            record = {
                "id": f"chunk-{chunk_id}",
                "source": source,
                "text": para,
                "tier": tier,
                "trust_score": trust_score,
            }
            chunk_id += 1
            if hits:
                record["flagged_patterns"] = hits
                quarantined.append(record)
            else:
                clean_chunks.append(record)

    return {"clean_chunks": clean_chunks, "quarantined": quarantined}
