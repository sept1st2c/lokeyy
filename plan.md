# LOCI — Challenge 1: Cognition & Brand Memory Engine

## Mission (as understood)
Build a context/memory pipeline that stops an LLM from producing generic
brand copy — it must preserve a specific brand's vocabulary, constraints,
and judgment, be defended against poisoned/injected source docs, retrieve
only the context a query actually needs, run a draft→critic→(fetch-more or
refine) loop, and report a confidence/citation-accuracy score. Core focus
is GenAI/backend; UI is explicitly "supporting" only.

## Architecture (current, verified working end-to-end)
- **Backend:** Python + FastAPI, fully local, no deployment. `backend/main.py`.
- **Generative LLM:** Claude Code CLI headless print-mode
  (`claude -p --output-format json`), invoked via `subprocess`, authenticated
  through the local Claude Code/Claude.ai session (no separate paid API key).
  `backend/claude_client.py`.
- **Ingestion + defense:** regex heuristic quarantine at ingest time, plus
  structural "untrusted DATA" prompt-wrapping at generation time.
  `backend/ingestion.py`.
- **Source trust tiers (A/B/C):** every chunk/rule carries a tier + numeric
  trust_score, folded into `final_confidence` and surfaced per-citation in
  `sources_cited`. `SOURCE_TIERS` in `ingestion.py`.
- **Retrieval:** BM25 lexical search (`rank_bm25`) + graph-guided rule
  filtering (always include forbidden_term/taboo_topic, keyword-overlap for
  the rest). `backend/retrieval.py`.
- **Knowledge graph:** real `networkx.DiGraph` (rule nodes + `preferred_over`
  edges), built via one LLM extraction call per source document, persisted to
  `backend/data/graph_cache.json`. `backend/graph.py`, exposed via
  `export_graph_for_viz()` → `GET /api/graph`.
- **Critique loop:** draft → critic (structured: passes/violations/
  confidence/citation_accuracy/failure_reason) → if `insufficient_context`,
  fetch-more (wider retrieval) then refine; if `violation`, refine directly
  → re-critique → Haiku grounding/entailment check (additive, catches
  citations that exist but don't actually support their claim) → deterministic
  fabricated-citation regex check. `backend/critique.py`.
- **Demo data:** real, public Barco visual identity guidelines (extracted
  from the actual PDF) as `backend/data/barco_guide.txt` (tier A), a
  deliberately prompt-injected `poisoned_addendum.txt` (gets quarantined,
  demos the defense), and a low-authority `fan_notes.txt` (tier C, demos
  trust-tiering).
- **UI:** React + Vite + Tailwind at `frontend-react/` (dev: `npm run dev`,
  port 5173, proxies `/api/*` to the backend on :8000) — query view, trust
  badges, confidence/citation meters, thought-process trace timeline, graph
  visualization tab. A plain-HTML fallback still exists at `frontend/`.

## Real bugs found and fixed (via direct testing, not agent self-reports)
1. **CLI argv corruption (root cause):** `claude` resolves to a Windows
   `.cmd` shim; its argument-forwarding gets reprocessed by `cmd.exe`, so any
   argv value containing `< > | & ^` — anywhere in the string — silently
   corrupts the command line. Hit twice in different forms: a prompt
   starting with `--` read as an unknown option, and a JSON schema
   `description` field containing `->` (the `>` read as redirection) that
   produced an empty response with no error. Fixed at the root in
   `claude_client.py`: `prompt` goes via stdin, `system_prompt` goes via the
   (undocumented but real) `--system-prompt-file` flag, and `json_schema`
   (which has no file-based flag) now fails loudly via `_assert_argv_safe`
   instead of silently returning garbage.
2. **UTF-8 corruption:** `subprocess.run(..., text=True)` without an explicit
   `encoding` uses the platform default (cp1252 on this Windows machine), not
   UTF-8, corrupting any non-ASCII character the CLI emits (em-dashes, curly
   quotes) into mojibake/lone surrogates. Fixed by pinning `encoding="utf-8"`.
3. **passes/violations inconsistency:** the Haiku grounding check could
   append a "citation doesn't support its claim" violation without ever
   flipping `passes` to `False` (it ran after the critic loop already
   exited), so a response could report `passes: true` while listing a
   hallucination. Fixed: a failed grounding check now forces `passes=False`.

## Verified (live, this session)
- `GET /api/status`, `GET /api/graph`, `POST /api/query` all confirmed
  working against real data via direct HTTP calls (not just unit tests).
- Injection defense: the poisoned doc is reliably quarantined (5 regex
  patterns fire on it) and excluded from the index.
- Fetch-more branch and grounding check both observed firing correctly in
  real runs (not just the mocked test the critique agent wrote).
- `frontend-react` dev server confirmed serving the app AND proxying
  `/api/*` to the live backend (curled through the Vite dev server directly).

## Not yet decided / open questions
- Whether to also verify the UI visually in a real browser (only build +
  HTTP-level checks have been done so far, no screenshot/visual pass).
- Minor data-quality note (not blocking): the graph extraction pass filed a
  couple of full "Don't" example phrases (e.g. "We made a decision") under
  `forbidden_term` alongside true single-word banned terms — defensible per
  schema, but a rough edge if scrutinized closely.
