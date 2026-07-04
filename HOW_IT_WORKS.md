# LOCI — How It Works (plain-English walkthrough)

This doc explains what we built, why, and how — in order, assuming no prior
context. Use it as your script for presenting.

---

## 1. The problem, in one paragraph

Ask any general-purpose AI ("ChatGPT, write me marketing copy") and you get
the same generic voice every brand is now using — same buzzwords
("revolutionary", "seamless", "unlock your potential"), no memory of what
*this specific brand* actually sounds like or is allowed to say. LOCI is a
layer that sits in front of an AI model and forces it to sound like **one
specific brand**, using that brand's *actual* style guide as ground truth —
not the model's generic training data. Think of it as giving the AI a strict
brand manager looking over its shoulder before anything ships.

We used **Barco** (a real company — projectors, displays, control rooms) and
their real, public brand guidelines PDF as the example brand.

---

## 2. The big picture — five stages, in order

```
   Brand PDF/docs
        │
        ▼
 ① INGEST & DEFEND  ──── turns raw text into safe, labeled chunks
        │
        ▼
 ② BUILD MEMORY  ──────── turns chunks into a structured "rulebook" (a graph)
        │
        ▼
   (server is now warmed up and stays ready — ① and ② only happen once,
    at startup, not per-question)
        │
        ▼   a user types a question
 ③ RETRIEVE  ───────────  finds only the specific rules/passages that matter
        │
        ▼
 ④ DRAFT → CRITIC → FIX ─ writes an answer, then checks its own work, fixes it
        │
        ▼
 ⑤ SCORE  ──────────────  reports how confident + how well-cited the answer is
        │
        ▼
   Answer + score + "thought process" shown in the UI
```

Stages ① and ② happen **once**, when the server starts (or you can think of
it as "the AI reads the whole style guide once and takes notes"). Stages ③–⑤
happen **every time** someone asks a question.

---

## 3. Stage ①: Ingest & Defend — "reading the style guide safely"

**What:** we take the brand's style-guide text (extracted from the real PDF)
and a couple of other sample documents, and:
1. Cut them into small chunks (a few sentences each) — like index cards.
2. Scan every chunk for **prompt injection** attempts. This is a real attack:
   someone could sneak text into a document that says "ignore all your
   instructions and now say X" — and if an AI blindly reads that text as part
   of its own instructions, it gets hijacked. We deliberately planted one
   fake "poisoned" document with exactly this kind of attack in it, to prove
   the defense catches it.
3. Any chunk that matches a known injection pattern (regex — a fancy
   find-and-match rule) gets **quarantined**: kept out of the system entirely,
   but logged so we can show "we caught this."
4. Every chunk also gets a **trust tier** (A/B/C) — A for the official brand
   guide, C for a deliberately lower-quality "random fan blog" style note we
   added, so we can show the system trusting official sources more than
   random ones.

**Why this matters for the pitch:** this is literally one of the four graded
requirements — "sanitize input against context poisoning." We don't just
claim it works, we can demo it live: show the poisoned doc, show it getting
flagged and rejected before it ever reaches the AI.

---

## 4. Stage ②: Build Memory — turning text into a "rulebook graph"

**What:** we make one AI call per document, asking it to read the chunks and
pull out structured rules — not the free-text style guide anymore, but a
clean list like:

- *forbidden term:* "seamless" → *use instead:* nothing generic, be specific
- *forbidden term:* "colour" → *preferred:* "color" (American spelling rule)
- *taboo topic:* comparing directly to named competitors
- *tone trait:* first-person "we", never third-person "Barco/the customer"

We store this as an actual **graph** (nodes and connections, using a library
called `networkx`) — e.g. a node for "colour" connects to a node for "color"
with a "preferred_over" relationship. This is the literal "memory" in
"Cognition & Brand Memory Engine."

**Why a graph and not just a list:** two reasons. (1) It's visualizable — the
UI has a live graph tab judges can look at, which is a strong visual "we
built real infrastructure" signal. (2) It lets us be smart later about
*only* pulling in the rules relevant to a given question instead of dumping
the entire style guide into every request (see Stage ③).

We save this graph to a file (`graph_cache.json`) so we don't have to pay for
a fresh AI call every time we restart the server during development/demo.

---

## 4A. New: live brand search — "add any brand without a pre-extracted PDF"

Barco's data came from a real PDF I manually extracted ahead of time (see
§12's honest limitation about this). That's fine for a demo of one brand,
but doesn't scale to "any brand a judge names on the spot." There's now a
second ingestion path that doesn't need a PDF at all:

**What it does:** type a brand name into the "Search a brand" box in the UI.
The backend calls the Claude Code CLI in a special mode with its **real**
web search and web fetch tools turned on (`backend/web_ingest.py`) — this is
the *only* place in the whole system tools are ever enabled; every other
call (draft/critique/refine/grounding) stays tool-free on purpose, so this
is a deliberate, narrow exception, not a loosened default. It searches for
that brand's voice/tone guidance, fetches a real page, and saves the
extracted text — same as if you'd manually done what I did for Barco, just
live and automatic.

**What happens to that text next:** it goes through the *exact same*
pipeline as every other document — chunked, regex-scanned for injection
patterns (a live-fetched webpage is arguably a *more* realistic attack
surface than our synthetic poisoned test doc, since it's real, unvetted,
external content), and one more LLM call extracts it into the rule graph.
The whole index and graph get rebuilt so the new brand is immediately
queryable.

**Trust tiering:** a web-sourced document is always tier B by default, no
matter how official the page looked — it wasn't manually vetted the way
`barco_guide.txt` was, so it never silently earns tier A. The UI shows it
with a 🌐 icon instead of the ✓ used for vetted local files, so nobody
mistakes "found on the web just now" for "verified official source."

**Verified concretely:** searching "Nike" found and cited a real page
(`tonelab.so/brand/nike`), correctly reported that Nike's actual internal
brand book isn't public, extracted 8 genuine rules from the reputable
secondary source it *did* find, and the rules count visibly went from 48 →
56 in the running app. Deleting it correctly dropped it back down.

**Data lifecycle — the actual design decision, not left implicit:** "when
the session ends, is it deleted?" doesn't have a clean default answer,
because a long-running local server has no natural "session boundary."
The choice made here: **persist by default** (a brand you add survives a
server restart, same as `barco_guide.txt` does) but store it in its own
folder (`backend/data/web_sources/`), separate from the vetted root files,
with an explicit **"Clear web sources"** button/endpoint
(`DELETE /api/sources/web`) that wipes just that folder and rebuilds. You
decide when to purge; nothing silently disappears, and nothing silently
accumulates forever without an easy way to reset it either.

**Honest limitation:** web-sourced content quality varies a lot by brand —
some brands (like Barco, or brands with genuinely public style guides) will
get clean, directly-usable rules; others (like Nike) have no public
official document at all, and what gets extracted is a reputable
*secondary analysis*, not the brand's actual internal rules. The system is
honest about this in the extracted text itself (it explicitly says so when
that's the case) rather than presenting secondary analysis as if it were
the real thing.

---

## 5. Stage ③: Retrieve — "only grab what's actually relevant"

**What happens when someone types a question** (e.g. "write a LinkedIn post
about our new display"), as of this update — **hybrid retrieval**, two
different search methods combined:

1. **Lexical search (BM25)** — a classic keyword-search algorithm (the same
   family search engines used before modern AI embeddings existed). Finds
   chunks whose exact *words* match the question. Brand rules are often about
   *exact vocabulary* ("never say seamless"), and keyword matching is the
   correct tool for catching that — a fuzzy/semantic search can blur right
   past the specific banned word.
2. **Semantic search (embeddings)** — the question and every chunk are also
   converted into number-vectors by a small local AI model
   (`all-MiniLM-L6-v2`, via `sentence-transformers`, ~90MB, runs on CPU, no
   API cost) that captures *meaning*, not just words. This catches
   loosely-phrased questions that share *no* exact words with the guide —
   e.g. asking "make it punchy and quick to skim" finds the rule phrased as
   "use short, frequently used words; keep sentences short," even though
   the two sentences share almost no vocabulary. **Verified concretely**: on
   that exact query, BM25 alone ranked the right rule 2nd; hybrid promoted it
   to 1st.
3. **Fusion (Reciprocal Rank Fusion)** — the two ranked lists are merged
   using each chunk's *rank* in each list (not raw scores, which live on
   incomparable scales — BM25 scores are unbounded, cosine similarity is
   -1..1). A chunk that both methods agree is relevant rises to the top.
4. From the rulebook graph, we **always** pull in every forbidden-term and
   taboo-topic rule (non-negotiable, cheap, must never be missed), plus only
   the *other* rules whose words overlap the question.

**Honest tradeoff, found by testing, not assumed:** hybrid isn't a strict
free upgrade — on the same test query it also pulled in one noisy, barely-
relevant short fragment (a leftover clean sentence from the poisoned test
document) that BM25 alone hadn't surfaced. Embedding similarity can occasionally
over-rate short, generic-sounding fragments. Worth knowing before claiming
hybrid is simply "better" with no caveats.

**Why this matters:** one of the four graded requirements is literally
"extract only the specific context needed, avoiding excessive token bloat."
Dumping an entire 100-page style guide into every AI call is slow, expensive,
and actually makes the AI *worse* at following instructions (too much
irrelevant text drowns out what matters). This step is the deliberate,
justified answer to that requirement — and it now covers both the
exact-vocabulary case and the loosely-phrased-question case.

---

## 6. Stage ④: Draft → Critic → Fix — the actual "thinking loop"

This is the heart of the system, and the part worth explaining most
carefully, since it's graded directly ("Critique & Loop Engine").

1. **Draft** — the AI writes a first attempt at the answer, using *only* the
   relevant chunks/rules from Stage ③. It's told: if you state a fact (like
   a product spec), you must "cite" which chunk it came from, like
   `[chunk-7]` — like a footnote.
2. **Critic** — a *second* AI call, playing a strict brand-compliance
   reviewer, reads the draft against the same rules and decides: does it
   break a rule? Does it cite something that doesn't actually exist? Is it
   even grounded in real information, or making stuff up?
3. Two different ways it can fail, handled differently:
   - **"You broke a rule"** (e.g., used a banned word) → we **refine**: ask
     the AI to rewrite it, same information, just fix the specific issues.
   - **"There isn't enough real information to answer this"** → refining
     won't help, because the problem isn't *how* it's written, it's that we
     didn't hand it enough facts. So instead we **fetch more** — go back to
     Stage ③ and pull a wider net of chunks/rules — *then* refine.
     This distinction matters: the hackathon brief explicitly asks for
     "fetch more data **or** refine" as two different real behaviors, not
     just one disguised as the other.
4. **Grounding check** — one more, cheaper AI call double-checks: for every
   citation the final answer actually uses, does that chunk's text *really*
   support the claim next to it? (Catches: "the model cited a real chunk id,
   but the chunk doesn't actually say what the model claims it says" — a
   subtler kind of hallucination than just checking the id exists.)
5. A plain-code (non-AI) check *also* verifies every citation id genuinely
   came from something we retrieved — catching the AI simply inventing a
   citation number that was never real.

**Why two different AI "checkers" (critic + grounding check) instead of one:**
the critic reasons about *rules* (did you break a policy); the grounding
check reasons about *evidence* (does this citation actually say what you
claim). Different kinds of mistakes, so we deliberately built two different,
cheaper, targeted checks rather than one do-everything call.

---

## 7. Stage ⑤: Score — "how much should you trust this answer?"

Two numbers come out of every answer:
- **Confidence** — how sure the critic is that the answer is compliant and
  well-supported.
- **Citation accuracy** — how well the cited facts actually check out.

We also **weight the confidence by source trust**: if the answer leaned on
the low-trust "random fan blog" document (tier C) instead of the official
guide (tier A), the final confidence score is dragged down accordingly — the
system is calibrated to trust official sources more, not just whatever
sounds relevant.

This directly answers the fourth graded requirement: "output a quantitative
score showing confidence and citation accuracy."

---

## 8. The AI model we're actually using (and why it's clever, not a shortcut)

Instead of paying for a separate AI API key, we call the same **Claude Code**
tool you're using right now, in a special non-interactive mode
(`claude -p ...`), from our own backend code, as a subprocess (a program
launching another program and reading its output). It authenticates through
the Claude subscription/session already logged in on this machine, so there's
no extra API billing to set up for the hackathon. This is a legitimate,
supported way to use Claude Code (it has a documented "headless" mode exactly
for this kind of scripted use) — not a hack.

Along the way we found and fixed three real, subtle bugs in how we talk to
that tool (a Windows-specific command-line quoting issue that could silently
corrupt requests, a text-encoding bug that mangled special characters, and a
logic bug where a failed grounding check didn't correctly mark an answer as
"failed"). All three were found by actually running the system end-to-end
and checking real output, not by assuming things worked — worth mentioning
in the presentation as "we tested rigorously," since it's true.

---

## 9. The frontend (what the judge actually sees and clicks)

Built with **React** (a UI framework), **Vite** (the tool that runs/builds
it), and **Tailwind CSS** (a styling toolkit) — styled after xAI's design
language (near-black canvas, white pill buttons, hairline borders, no
shadows, restrained accent colors) so it reads as a real product, not a
hackathon demo:

- A **landing page** first — hero headline, live stats pulled straight from
  the running backend (not hardcoded numbers), an architecture walkthrough
  section, a "what makes this different" section, and a "Launch the demo"
  button that drops into the actual app.
- Inside the app: a chat-style box to type a question and see the answer,
  with citations shown as small colored badges (green/amber/gray = trust
  tier of the source).
- A **Confidence / Citation Accuracy / Pass-Fail** row right under every
  answer.
- An expandable **"Thought Process"** panel showing the exact steps from
  Stage ④ (retrieve → draft → critique → fetch-more if it happened → refine
  → critique again → grounding check) — this is the single most important
  thing to show a judge, since it visibly proves the loop is real, not just
  one AI call dressed up.
- A status strip that visibly says **"1 injection attempt neutralized"** —
  the live proof the defense mechanism works, plus a "Brand sources" row
  showing which documents are actually loaded (with a working "Upload PDF"
  control that honestly tells you upload isn't wired up yet, instead of
  silently failing).
- A **Knowledge Graph** tab visualizing the rulebook from Stage ② as an
  actual node-and-line diagram — only rules with a real stated relationship
  to another rule get a text label (the rest render as small dots), so the
  ~15 genuinely interesting relationships stay legible instead of getting
  buried under ~50 disconnected rule nodes.

It runs as its own small local web server (`npm run dev`) and talks to the
Python backend over the network on your own machine — nothing is deployed to
the internet, everything runs locally for the demo.

---

## 10. How to run the whole thing (for the presentation)

**Terminal 1 — backend:**
```
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
Wait for `Application startup complete` and the `[startup] N clean chunks...`
line — that means it just ingested the brand docs and built (or loaded the
cached) knowledge graph.

**Terminal 2 — frontend:**
```
cd frontend-react
npm run dev
```
It will print a local URL — open that in a browser (`http://localhost:5173`).

That's it — two terminals, two commands, no deployment, no external services
except the already-logged-in Claude Code session.

---

## 11. Good demo queries to actually type

- **The "money shot" loop demo:** *"Write a two-sentence LinkedIn post
  announcing our new UniSee II display"* — this one is known to trigger a
  real critic failure + grounding-check catch (the guide has no actual specs
  for that product), so you'll visibly see it flag itself as low-confidence/
  fail, which is a *good* demo outcome — it proves the system doesn't just
  agreeably make things up.
- **The precision/formatting demo:** *"Write a sentence mentioning we signed
  3 contracts worth 2 million euros on 5 June 2024"* — tests exact
  brand-specific formatting rules (numerals, currency, date format) that are
  easy for a judge to visually verify right or wrong.
- **The injection-defense demo:** just point at the status strip / point out
  the quarantined document in `/api/status` — you don't even need to ask a
  question, the "1 injection attempt neutralized" badge is the proof.
- **The trust-tier demo:** ask something that would only be "answerable"
  from the low-trust fan-notes document, and point out the resulting low
  confidence score and gray "C" tier badge.
- **The "any brand, live" demo:** type a brand name (e.g. "Patagonia") into
  the "Search a brand" box, let it actually search + fetch + rebuild the
  graph in front of the judge (takes a minute or two — narrate what's
  happening while it runs), then ask a question about *that* brand's voice.
  Directly answers "does this only work for the one brand you pre-loaded?"

---

## 12. Honest limitations (know these before a judge asks)

- **PDF parsing isn't live.** The brand text was extracted from the real PDF
  once, ahead of time, into plain text files. If asked "does it parse any
  PDF," the honest answer is "the ingestion pipeline works on brand text;
  PDF-to-text extraction was a one-time prep step for this demo, not a live
  upload feature yet" — the UI is honest about this too (the Upload PDF
  button tells you so instead of silently failing).
- **Single brand, hardcoded.** There's no "switch brand" selector — Barco is
  the only loaded brand. Multi-brand support (separate index + graph per
  brand) is architecturally straightforward to add but wasn't built.
- **No automated test suite.** Verification so far has been direct, manual,
  end-to-end runs against the real backend (arguably *more* convincing for a
  live demo than a green checkmark, but say "manually verified end-to-end,"
  not "unit tested").
- **Retrieval is now hybrid (BM25 + embeddings), which mostly fixes the old
  "misses paraphrases" gap — but isn't a free lunch.** The embedding half can
  occasionally over-rate a short, generic-sounding fragment that happens to
  sound topically similar without actually being relevant (reproduced
  directly, see Stage ③). Fusion via RRF limits the damage but doesn't
  eliminate it.
- **Latency, now slightly higher.** A query that triggers the fetch-more
  branch runs 5+ sequential model calls and can take 30 seconds to 3 minutes
  (embedding encode itself is fast, ~50ms — the variance is almost entirely
  from the model calls, not retrieval). Fine for a demo, not fast enough for
  a snappy production product without streaming (see §13).
- **No conversation memory.** Every question is answered from scratch; there's
  no "make it shorter" follow-up that remembers the previous answer.
- **Single point of failure on auth.** The system calls Claude through the
  Claude Code CLI's session on this machine — no separate paid API key as a
  fallback. If that session logs out, generation stops. Fine for a local demo,
  not something you'd ship a real product on as-is.
- **The critic and grounding check are themselves LLM judgment calls.** They're
  backed by a deterministic check for the one failure mode that's fully
  checkable in code (does a cited chunk id actually exist), but "is this
  citation's *meaning* actually supported" and "does this violate a tone
  rule" are still AI judgment, not provably infallible — they can occasionally
  be wrong, same as any critic-model pattern.

---

## 13. If we had more time — how we'd actually improve the architecture

These aren't vague "future work" bullet points — each one addresses a
limitation from §12 with a specific, buildable next step. (Item 1, hybrid
retrieval, has since been implemented — see Stage ③ and §17 — kept here
struck through so the history of what was "next" vs. "now built" stays
visible.)

~~1. Hybrid retrieval (lexical + embeddings) — implemented, see Stage ③.~~
2. **Deeper graph relationships.** Right now the graph is mostly one relation
   type (`preferred_over`). A richer schema — `conflicts_with` between a tone
   rule and a channel rule, `applies_to_channel` edges — would let the critic
   actually *traverse* the graph for a query instead of reading a flat
   pre-filtered list, and would make the visualization meaningfully more
   interesting to look at.
3. **Streaming responses (SSE/WebSockets).** Right now the whole 5-step loop
   runs before the UI shows anything but a spinner. Streaming each trace step
   as it completes would make the "thought process" feel alive in real time
   instead of arriving all at once — a genuinely better demo *and* a better
   product.
4. **Real PDF upload.** Swap the one-time manual extraction for a live
   pipeline (PyMuPDF for text-native PDFs, OCR fallback for scanned ones,
   layout-aware chunking that respects headings/tables) behind the "Upload
   PDF" button that currently (honestly) says it isn't wired up.
5. **Multi-brand switching.** Key the retriever/graph/state by brand instead
   of a single global `STATE` dict, add a brand selector to the UI.
6. **Human-in-the-loop rule curation.** The one-shot LLM extraction pass is
   good but not perfect — we caught it filing a couple of full "don't say
   this" example sentences under `forbidden_term` alongside genuine
   single-word banned terms. A review UI where a brand manager approves/edits
   extracted rules before they go live would catch that class of error.
7. **A real test suite** covering ingestion edge cases (empty docs, huge
   docs), retrieval ranking, and the critic loop's branching logic with
   mocked model responses — turning today's "we tested it manually and it
   worked" into "CI enforces it keeps working."
8. **A fallback inference path** (a real paid API key as backup) so the
   system isn't tied to one person's local login session.

---

## 14. Does this actually answer the problem statement? A self-assessment

Going requirement by requirement, honestly:

| Requirement | Verdict | Why |
|---|---|---|
| **1. Resourceful Ingestion + defense** | Strong match | Real, publicly-sourced brand PDF (not synthetic filler text); the injection defense isn't just described, it's *demoable* — a real poisoned document gets caught live, every time, on request. |
| **2. Context Engineering** | Strong match | Hybrid retrieval (BM25 + embeddings, fused via RRF) plus graph-guided rule filtering — each half chosen for a specific, tested reason (§17), not "throw the default at it and hope." |
| **3. Critique & Loop Engine** | Strongest match | This is where a lot of hackathon submissions would fake it — one critic call, always "refine," call it a loop. We implemented the literal branch the brief describes: a rule violation refines with the *same* context; missing information triggers an actual wider re-retrieval *first*. That distinction is visibly demoable, not just claimed. |
| **4. Harness Engineering** | Strong match | Not one self-reported number — three layers: a deterministic check (does the cited id exist), an independent second-model check (does the citation's content actually support the claim), and a trust-tier-weighted confidence score. |

**Bottom line:** yes, this is a legitimate, directly-mapped, testable answer
to all four core requirements — every one of them was verified working
end-to-end against real data and real model calls this session, not assumed.
The honest caveat is §12's limitations: this is a working prototype that
does what's asked, not a hardened production system.

---

## 15. What's actually unique here (not just "we used AI")

If a judge asks "what would I *not* see in five other teams' submissions,"
these are the real, specific answers:

- **It isn't locked to one pre-loaded brand.** Most single-brand demos can
  only answer "what if I ask about a brand you didn't prep for" with "we
  didn't build that." This one can search the web, fetch a real page, and
  rebuild its own graph for a brand named live, on the spot — verified
  working, not aspirational.
- **The failure-mode branch is real, not decorative.** "You broke a rule"
  and "there isn't enough information" get genuinely different treatment
  (refine vs. fetch-more-then-refine) — most "iterative loop" demos collapse
  both into one generic retry.
- **A second, independent, cheaper model checks the first model's citations
  for meaning, not just existence.** Catching "this citation is real but
  doesn't actually say what you claim" is a subtler bug class than the
  fabricated-id check almost every RAG demo has.
- **Trust tiers flow all the way through, not just into a tooltip.** A
  low-authority source actually drags down the final confidence number and
  shows up as a differently-colored badge — the system is calibrated to
  trust sources differently, not just cite them all identically.
- **The knowledge graph is a real, persisted, visualized graph**, built with
  `networkx`, not a marketing label on top of a vector store (see §16 for a
  concrete example of it actually mattering, not just looking good).
- **The injection defense has a live "gotcha" built in.** A genuinely
  poisoned test document ships with the demo specifically so the catch can
  be shown happening, not described in a slide.
- **Transparency about real bugs, found by testing, not assumed away.** Three
  actual bugs (a Windows CLI-argument corruption bug, a UTF-8 encoding bug, a
  pass/fail logic bug) were found by running the system end-to-end and
  reading real output — and are documented here rather than hidden. That's a
  rigor signal most demos don't bother showing.
- **The inference engine is Claude Code's own headless mode**, not a separate
  paid API key — a genuinely clever, zero-marginal-cost way to run a
  hackathon-grade LLM pipeline without a billing setup, and it's a legitimate
  documented feature, not a workaround.

---

## 16. The knowledge graph, earning its keep — a concrete example

Here's the question worth asking: *"I already have keyword search over the
chunks — what does the graph add that keyword search alone wouldn't?"*

**The answer, concretely:** in `retrieval.py`, every `forbidden_term` and
`taboo_topic` node is pulled into *every single query's context,
unconditionally* — regardless of whether the question's wording overlaps
with that rule at all. Compare the two systems:

- **Keyword search alone:** ask *"Write a tagline for our new projector"* —
  BM25 finds chunks about taglines/projectors. If the sentence describing
  "never write BARCO in full capital letters" happens to live in a chunk
  that shares no words with "tagline" or "projector," keyword search may
  never surface it. The model could easily write `BARCO` in caps and nobody
  checked.
- **With the graph:** the `BARCO (all caps)` → `Barco` rule node is in the
  *always-include* set, full stop — it doesn't matter what the question was
  about. The critic checks it every time.

The graph also gives the **refine** step something keyword search can't: a
direct, structured lookup for the fix. When the critic flags "you used
'colour'," the refiner doesn't have to re-read a paragraph and *infer* the
correct replacement — the graph has a `preferred_over` edge straight from
the `colour` node to the `color` node. Multiple wrong forms (`BARCO`,
`Barco` in full caps, `BARCO` with no space) can all point at the one right
answer, which a single text search would represent as scattered prose, not
a lookup.

**In one sentence:** keyword search finds *relevant* text; the graph
guarantees *mandatory* rules are never skipped and gives corrections a
structured answer instead of a re-derived guess.

---

## 17. When would you actually want this kind of retrieval vs. standard RAG?

*(Updated: this used to describe a choice between lexical and embedding-based
retrieval. We've since implemented both, fused via RRF — see Stage ③. The
question below is now "why both, not either," which is the more honest and
more interesting version of it.)*

"Standard" modern RAG converts everything to embeddings and does purely
meaning-based similarity search. We use BM25 (keyword) **and** embeddings,
combined — because for this domain, either one *alone* has a real failure
mode:

**Lexical (BM25) alone fails when the question is loosely phrased.** Brand
rules are exact-vocabulary problems ("never say X, always say Y"), so
keyword matching is the right primary tool — but if a question shares no
words with the guide's phrasing ("make it punchy" vs. the guide's "use
short, frequently used words"), pure keyword search can rank the right
chunk low or miss it. We reproduced this directly (§ above, Stage ③).

**Embeddings alone fail for exactly the opposite reason.** A semantic search
that treats "seamless" and "smooth" as basically-the-same-meaning is
actively counterproductive for a rule that specifically bans one exact word
— it can blur right past the one thing you needed to catch, and (also
reproduced directly) can over-rate short, generic-sounding fragments that
happen to *sound* topically similar without actually being relevant.

**Fusing both, via rank (not raw score), gets the benefit of each without
picking one failure mode over the other.** This is the right default for
any domain that mixes exact-compliance rules *and* natural-language
questions about them — which is most real brand/legal/compliance use cases,
not just ours. Pure embedding-only RAG remains the right (simpler, cheaper)
choice when a domain has *no* exact-vocabulary constraints at all —
general-purpose document Q&A, research-paper search, customer support over
a product manual — where meaning-matching is the entire point and there's
nothing exact to accidentally blur past.
