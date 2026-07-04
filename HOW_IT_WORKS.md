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

## 5. Stage ③: Retrieve — "only grab what's actually relevant"

**What happens when someone types a question** (e.g. "write a LinkedIn post
about our new display"):

1. We search the chunks for the ones whose *words* best match the question.
   We use a classic keyword-search algorithm called **BM25** (the same family
   of algorithm search engines used before modern AI embeddings existed) —
   deliberately **not** the fancier "AI embedding similarity search" you
   might have heard of, because brand rules are about *exact words* ("never
   say seamless") and keyword matching is actually the *more correct* tool
   for that, not a compromise.
2. From the rulebook graph, we **always** pull in every forbidden-term and
   taboo-topic rule (non-negotiable, cheap, must never be missed), plus only
   the *other* rules whose words overlap the question.

**Why this matters:** one of the four graded requirements is literally
"extract only the specific context needed, avoiding excessive token bloat."
Dumping an entire 100-page style guide into every AI call is slow, expensive,
and actually makes the AI *worse* at following instructions (too much
irrelevant text drowns out what matters). This step is the deliberate,
justified answer to that requirement.

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
it), and **Tailwind CSS** (a styling toolkit) — a dark, modern single page:

- A chat-style box to type a question and see the answer, with citations
  shown as small colored badges (green/amber/gray = trust tier of the
  source).
- A **Confidence / Citation Accuracy / Pass-Fail** row right under every
  answer.
- An expandable **"Thought Process"** panel showing the exact steps from
  Stage ④ (retrieve → draft → critique → fetch-more if it happened → refine
  → critique again → grounding check) — this is the single most important
  thing to show a judge, since it visibly proves the loop is real, not just
  one AI call dressed up.
- A status strip that visibly says **"1 injection attempt neutralized"** —
  the live proof the defense mechanism works.
- A **Knowledge Graph** tab visualizing the rulebook from Stage ② as an
  actual node-and-line diagram.

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

---

## 12. Honest limitations (know these before a judge asks)

- The graph visualization can still look a little crowded with unconnected
  nodes at the edges — it's a stretch/cosmetic feature, not core-graded.
- No automated test suite — verification so far has been direct, manual,
  end-to-end runs (which is arguably *more* convincing for a live demo, but
  say "manually verified" not "unit tested").
- PDF parsing itself isn't live in the running app — the brand text was
  extracted from the real PDF once, ahead of time, into plain text files.
  If asked "does it parse any PDF," the honest answer is "the ingestion
  pipeline works on brand text; PDF-to-text extraction was a one-time prep
  step for this demo, not a live upload feature yet."
