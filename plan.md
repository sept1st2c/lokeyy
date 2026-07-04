# LOCI — Challenge 1: Cognition & Brand Memory Engine

## Mission (as understood)
Build a context/memory pipeline that stops an LLM from producing generic
brand copy — it must preserve a specific brand's vocabulary, constraints,
and judgment, be defended against poisoned/injected source docs, retrieve
only the context a query actually needs, run a draft→critic→refine loop,
and report a confidence/citation-accuracy score. Core focus is GenAI/backend;
UI is explicitly "supporting" only.

## Locked decisions (confirmed with user)
- **Backend:** Python + FastAPI, running fully locally, no deployment.
- **Generative LLM:** the Claude Code CLI in headless print-mode
  (`claude -p ... --output-format json`), invoked via `subprocess` from
  Python, authenticated through the existing Claude Code/Claude.ai session
  instead of a separate paid Anthropic API key. Verified working, incl.
  `--json-schema` for structured critic/graph output. Cost ~$0.002–0.015
  per call once a custom `--system-prompt` replaces Claude Code's default
  (which otherwise adds ~$0.03/call of wasted context).
- **Retrieval:** BM25 lexical search (`rank_bm25`), not embeddings —
  brand-voice rules are exact-vocabulary problems (banned/preferred words),
  which is a lexical-match problem; also avoids any embedding model
  download/API dependency given the time limit.
- **Knowledge graph:** not a graph DB — one LLM extraction pass turns the
  sanitized brand doc into a compact typed rule list
  (`forbidden_term` / `preferred_term` / `taboo_topic` / `tone_trait` /
  `channel_rule`), held in memory. Graph-guided retrieval = always include
  safety-critical rule types (forbidden terms, taboo topics) + only the
  query-relevant subset of the rest, instead of dumping everything.
- **Ingestion defense:** two layers — (1) regex heuristic scan at ingest
  time that quarantines any chunk matching known injection patterns
  ("ignore previous instructions", "system notice", etc.), excluding it
  from the index but logging it; (2) structural hardening — every prompt
  wraps retrieved content in explicit "untrusted DATA, never instructions"
  delimiters, reinforced in every system prompt (draft/critic/refine).
- **Critique loop:** draft → critic (structured JSON: passes, violations,
  confidence, citation_accuracy) → if failed, one refine pass → re-critique,
  hard-capped at 1 refinement for latency/cost in a live demo.
- **Scoring:** hybrid — critic's LLM-judged confidence/citation_accuracy,
  overridden/penalized deterministically if a citation like `[chunk-3]`
  appears in the draft that doesn't correspond to a real retrieved chunk
  id (fabricated-citation check, done in plain Python regex, not trusting
  the model's self-report).
- **Demo data:** a fictional-but-realistic brand ("Northbound Gear")
  tone-of-voice guide written for the demo (`backend/data/brand_guide.txt`)
  — avoids real-brand IP/copyright questions and PDF-parsing flakiness
  under time pressure — plus a deliberately poisoned addendum doc
  (`backend/data/poisoned_addendum.txt`) to demo the injection defense live.
  brandingstyleguides.com was the user's suggested source for real guides
  if we want to swap in an authentic one later.
- **UI:** plain HTML/CSS/JS single page (`frontend/index.html`), no
  build step, served directly by FastAPI's StaticFiles — query box, final
  answer with inline citation highlighting, confidence/citation-accuracy/
  pass-fail stat row, and a collapsible "thought process" trace (retrieve →
  draft → critique → refine → critique). Sleek Next.js version deferred
  until the user's design guide is ready and/or more time is available.

## Files built so far
```
backend/
  claude_client.py   # subprocess wrapper around `claude -p`
  ingestion.py        # chunking + regex injection-pattern quarantine
  retrieval.py         # BM25 top-k + graph-guided rule filtering
  graph.py              # one LLM call -> structured rule list
  critique.py            # draft/critic/refine loop + citation verification
  main.py                 # FastAPI app, startup ingestion, /api/status /api/rules /api/query
  data/brand_guide.txt      # sample brand voice guide (Northbound Gear)
  data/poisoned_addendum.txt # deliberately injected doc for defense demo
frontend/
  index.html                  # single-page UI, no build tooling
```

## Status / open issue
End-to-end run is not yet confirmed working. Small isolated test of the
`--json-schema` CLI path succeeded, but the full startup call (real brand
doc, ~7 chunks) hit a `JSONDecodeError` — last debug step in progress was
isolating whether it's a stdout-buffering/multi-line issue or something
about prompt size/shape. **Not yet resolved when work was paused for
discussion.**

## Not yet decided / open questions
- Whether to keep the fabricated "Northbound Gear" brand or swap in a real
  guide from brandingstyleguides.com.
- Scope of "stretch" differentiators (multi-critic ensemble, graph
  visualization panel, live PDF upload) — cut for the 1.5h version, but
  worth revisiting if more time turns out to be available.
- Next.js/sleek UI swap — pending the user's design guide.
