import re

import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
_MODEL: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _MODEL
    if _MODEL is None:
        _MODEL = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _MODEL


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


class Retriever:
    """BM25 lexical retrieval over ingested brand-doc chunks -- the exact-
    vocabulary half of hybrid retrieval (see HybridRetriever below).

    Lexical (not embedding) search is used deliberately for THIS half: brand
    voice rules are about exact vocabulary (specific banned/preferred words),
    which is a keyword-matching problem a semantic search would blur past
    (treating "seamless" and "smooth" as basically the same meaning is a
    liability here, not a feature). This is combined with an embedding-based
    semantic layer purely to widen recall for loosely-phrased/paraphrased
    questions that share no exact words with the guide -- see HOW_IT_WORKS.md
    Stage 3 and section 17 for the full reasoning.
    """

    def __init__(self, chunks: list[dict]):
        self.chunks = chunks
        self.bm25 = BM25Okapi([tokenize(c["text"]) for c in chunks]) if chunks else None

    def top_k(self, query: str, k: int = 3) -> list[dict]:
        if not self.chunks:
            return []
        scores = self.bm25.get_scores(tokenize(query))
        ranked = sorted(zip(scores, self.chunks), key=lambda x: -x[0])
        top = [c for s, c in ranked[:k] if s > 0]
        return top if top else [c for _, c in ranked[:k]]


class EmbeddingIndex:
    """Semantic recall layer: catches paraphrased questions that share no
    exact words with the guide, which BM25 alone would miss (e.g. a question
    asking to "make it punchy and easy to skim" when the guide phrases the
    same rule as "use short, frequently used words; keep sentences short").
    Not a replacement for exact-vocabulary matching -- combined with it via
    HybridRetriever, never used alone, since paraphrase-tolerant matching is
    actively wrong for catching a specific banned word.
    """

    def __init__(self, chunks: list[dict]):
        self.chunks = chunks
        self.embeddings = (
            _get_model().encode([c["text"] for c in chunks], normalize_embeddings=True)
            if chunks
            else None
        )

    def top_k(self, query: str, k: int = 3) -> list[dict]:
        if not self.chunks:
            return []
        q_emb = _get_model().encode([query], normalize_embeddings=True)[0]
        scores = self.embeddings @ q_emb  # cosine similarity (both sides normalized)
        ranked_idx = np.argsort(-scores)[:k]
        return [self.chunks[i] for i in ranked_idx]


def _rrf_fuse(rankings: list[list[dict]], k: int = 60, top_k: int = 3) -> list[dict]:
    """Reciprocal Rank Fusion: merge multiple ranked lists using each item's
    *rank* in each list, not its raw score -- deliberately avoids having to
    normalize BM25 scores (unbounded, corpus-dependent) against cosine
    similarities (bounded -1..1), which live on incomparable scales. Standard
    formula: score(item) = sum over rankings of 1 / (k + rank_in_that_ranking).
    """
    scores: dict[str, float] = {}
    by_id: dict[str, dict] = {}
    for ranking in rankings:
        for rank, item in enumerate(ranking):
            scores[item["id"]] = scores.get(item["id"], 0.0) + 1.0 / (k + rank + 1)
            by_id[item["id"]] = item
    ranked_ids = sorted(scores, key=lambda i: -scores[i])[:top_k]
    return [by_id[i] for i in ranked_ids]


class HybridRetriever:
    """BM25 (exact vocabulary) + embeddings (semantic recall), fused via
    Reciprocal Rank Fusion. This is the retriever the app actually uses --
    Retriever and EmbeddingIndex are its two halves, each individually
    insufficient for this domain on its own.
    """

    def __init__(self, chunks: list[dict]):
        self.bm25 = Retriever(chunks)
        self.semantic = EmbeddingIndex(chunks)

    def top_k(self, query: str, k: int = 3) -> list[dict]:
        if not self.bm25.chunks:
            return []
        candidate_k = max(k * 2, 5)
        lexical = self.bm25.top_k(query, k=candidate_k)
        semantic = self.semantic.top_k(query, k=candidate_k)
        return _rrf_fuse([lexical, semantic], top_k=k)


_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "to", "of",
    "for", "in", "on", "at", "by", "with", "and", "or", "our", "your", "we",
    "i", "you", "it", "this", "that", "new", "write", "make",
}


def graph_guided_rules(
    query: str,
    rules: list[dict],
    max_contextual: int = 6,
    relevant_sources: set[str] | None = None,
) -> list[dict]:
    """Context-engineering step: rather than dumping the whole rule graph,
    pull the always-enforced safety-critical rules (banned terms / taboo
    topics are cheap and non-negotiable) plus only the query-relevant subset
    of everything else, keyed by keyword/channel overlap.

    `relevant_sources`: when multiple brands are loaded at once (see
    web_ingest.py), a brand's rules must never leak into another brand's
    answer -- e.g. Barco's "never say colour" rule has no business appearing
    in a Nike-voice query. Pass the set of chunk `source` filenames the
    retriever already identified as relevant for this query (retrieval.py's
    hybrid search is already brand-aware via real semantic+lexical
    matching -- this reuses that signal instead of re-deriving it) to scope
    the rule pool down to just those brands' rules before ranking. Without
    it, falls back to the full rule set (single-brand behavior, unchanged).
    """
    if relevant_sources:
        rules = [r for r in rules if r.get("source") in relevant_sources]

    q_tokens = set(tokenize(query)) - _STOPWORDS

    always_include = [
        r for r in rules
        if r.get("type") in ("forbidden_term", "taboo_topic")
    ]

    candidates = [r for r in rules if r not in always_include]

    def overlap_score(rule: dict) -> int:
        rule_text = f"{rule.get('value', '')} {rule.get('note', '')} {rule.get('channel', '')}"
        return len(q_tokens & (set(tokenize(rule_text)) - _STOPWORDS))

    scored = sorted(candidates, key=overlap_score, reverse=True)
    contextual = [r for r in scored if overlap_score(r) > 0][:max_contextual]

    return always_include + contextual
