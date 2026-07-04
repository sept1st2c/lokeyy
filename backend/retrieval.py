import re
from rank_bm25 import BM25Okapi


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


class Retriever:
    """BM25 lexical retrieval over ingested brand-doc chunks.

    Lexical (not embedding) search is used deliberately: brand voice rules
    are about exact vocabulary (specific banned/preferred words), which is
    a keyword-matching problem, not a semantic-similarity one -- and it
    avoids any embedding-model download/API dependency.
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


def graph_guided_rules(query: str, rules: list[dict], max_contextual: int = 6) -> list[dict]:
    """Context-engineering step: rather than dumping the whole rule graph,
    pull the always-enforced safety-critical rules (banned terms / taboo
    topics are cheap and non-negotiable) plus only the query-relevant subset
    of everything else, keyed by keyword/channel overlap.
    """
    q_tokens = set(tokenize(query))

    always_include = [
        r for r in rules
        if r.get("type") in ("forbidden_term", "taboo_topic")
    ]

    candidates = [r for r in rules if r not in always_include]

    def overlap_score(rule: dict) -> int:
        rule_text = f"{rule.get('value', '')} {rule.get('note', '')} {rule.get('channel', '')}"
        return len(q_tokens & set(tokenize(rule_text)))

    scored = sorted(candidates, key=overlap_score, reverse=True)
    contextual = [r for r in scored if overlap_score(r) > 0][:max_contextual]

    return always_include + contextual
