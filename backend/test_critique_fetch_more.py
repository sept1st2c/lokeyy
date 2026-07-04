"""
Standalone test that stubs claude_client.call_claude so we can deterministically
force the insufficient_context -> fetch_more -> refine -> critique path,
without depending on the real model's judgment or network/CLI latency.
Run: python test_critique_fetch_more.py
"""
import critique


class _FakeRetriever:
    def __init__(self, small, wide):
        self.small = small
        self.wide = wide

    def top_k(self, query, k=3):
        return self.wide[:k] if k > 3 else self.small[:k]


def main():
    calls = {"n": 0}

    def fake_call_claude(prompt, system_prompt, json_schema=None, model="sonnet", timeout=60):
        calls["n"] += 1
        if json_schema is None:
            # draft or refine call -> just return a plain string
            if "VIOLATIONS TO FIX" in prompt:
                return "Refined answer using expanded context [chunk-1] [chunk-3]."
            return "Initial vague draft with weak grounding [chunk-1]."
        if json_schema is critique.CRITIC_SCHEMA:
            # First critic call: fail with insufficient_context.
            # Second critic call (after fetch_more + refine): pass.
            if calls["n"] <= 2:
                return {
                    "passes": False,
                    "violations": ["Claim not well supported by retrieved context"],
                    "confidence": 40,
                    "citation_accuracy": 50,
                    "failure_reason": "insufficient_context",
                }
            return {
                "passes": True,
                "violations": [],
                "confidence": 90,
                "citation_accuracy": 95,
                "failure_reason": "none",
            }
        if json_schema is critique.GROUNDING_SCHEMA:
            return {"results": [{"id": "chunk-1", "supported": True, "reason": "ok"},
                                 {"id": "chunk-3", "supported": True, "reason": "ok"}]}
        raise AssertionError("unexpected schema")

    critique.call_claude = fake_call_claude

    small_chunks = [{"id": "chunk-1", "text": "Rated to -20C and 40kg."}]
    wide_chunks = small_chunks + [
        {"id": "chunk-2", "text": "Forest Green colorway.", "tier": "B", "trust_score": 0.8},
        {"id": "chunk-3", "text": "IPX7 waterproof rating.", "tier": "A", "trust_score": 0.9},
    ]
    retriever = _FakeRetriever(small_chunks, wide_chunks)
    rules = [{"type": "forbidden_term", "value": "cheap", "note": "no", "channel": None}]

    result = critique.answer_query("durability blurb", retriever, rules)

    steps = [t["step"] for t in result["trace"]]
    print("trace steps:", steps)
    assert "fetch_more" in steps, "fetch_more step missing from trace"
    fetch_step = next(t for t in result["trace"] if t["step"] == "fetch_more")
    print("fetch_more entry:", fetch_step)
    assert fetch_step["reason"] == "insufficient_context"
    assert "chunk-3" in fetch_step["new_chunks_used"] or "chunk-2" in fetch_step["new_chunks_used"]

    assert result["passes"] is True
    print("sources_cited:", result["sources_cited"])
    print("final_confidence:", result["final_confidence"])
    print("PASS: fetch_more path exercised correctly, no crash.")


if __name__ == "__main__":
    main()
