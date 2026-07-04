import { useEffect, useState } from "react";
import Reveal from "./Reveal.jsx";
import CountUp from "./CountUp.jsx";
import BuzzwordTicker from "./BuzzwordTicker.jsx";
import GraphView from "./GraphView.jsx";
import GradientLine from "./GradientLine.jsx";
import TraceTerminal from "./TraceTerminal.jsx";
import CodeSnippet from "./CodeSnippet.jsx";
import { getStatus } from "../lib/api.js";

function Eyebrow({ children, tone = "body-mid" }) {
  return (
    <div
      className={`font-mono-brand uppercase text-[12px] tracking-[1.4px] text-${tone} mb-4`}
    >
      {children}
    </div>
  );
}

const STAGES = [
  {
    n: "01",
    title: "Ingest & Defend",
    body:
      "Brand documents are chunked and regex-scanned for prompt-injection patterns before anything reaches the index. Anything suspicious is quarantined, not trusted — logged, not silently absorbed.",
    tags: ["regex heuristics", "structural prompt-hardening", "trust tiers A/B/C"],
  },
  {
    n: "02",
    title: "Build Memory",
    body:
      "One extraction pass turns free-text guidelines into a typed rule graph — forbidden terms, preferred alternatives, taboo topics, tone traits — persisted as a real networkx graph, not a flat list.",
    tags: ["networkx", "graph_cache.json", "preferred_over edges"],
  },
  {
    n: "03",
    title: "Retrieve",
    body:
      "BM25 keyword search, deliberately not embeddings — brand rules are exact-vocabulary problems. Every forbidden term is always checked; everything else is pulled only if it overlaps the question.",
    tags: ["rank_bm25", "graph-guided filtering", "no vector DB"],
  },
  {
    n: "04",
    title: "Draft → Critic → Fix",
    body:
      "A draft is written, then critiqued against the rule graph. A real rule violation gets refined with the same context; missing information triggers an actual wider re-retrieval first.",
    tags: ["fetch-more branch", "structured critic", "citation verification"],
  },
  {
    n: "05",
    title: "Score",
    body:
      "A cheaper model double-checks that every citation actually supports its claim — not just that the id is real. Confidence is weighted by the trust tier of whatever was actually cited.",
    tags: ["grounding check", "trust-weighted confidence", "citation accuracy"],
  },
];

const DIFFERENTIATORS = [
  {
    title: "The defense is demoable, not claimed",
    body: "A deliberately poisoned document ships with the demo. Ask to see it caught live.",
  },
  {
    title: "Two failure modes, two different fixes",
    body: '"You broke a rule" gets refined. "There isn’t enough information" triggers real re-retrieval — most loop demos fake this as one behavior.',
  },
  {
    title: "A second, cheaper model checks the first one's work",
    body: "The grounding check catches citations that exist but don't actually say what the draft claims — a subtler bug than a fabricated id.",
  },
  {
    title: "Found and fixed under test, not assumed correct",
    body: "Three real bugs surfaced by running the system end-to-end: a Windows CLI-argument corruption bug, a UTF-8 encoding bug, and a logic bug where a failed check didn't flip the pass/fail badge.",
  },
];

const STACK = [
  "Python", "FastAPI", "React", "Vite", "Tailwind CSS",
  "Claude Code (headless)", "BM25 / rank_bm25", "NetworkX",
];

function StatBlock({ value, label, accent }) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="font-display text-5xl md:text-6xl font-normal tracking-[-2px]"
        style={{ color: accent }}
      >
        <CountUp value={value} />
      </div>
      <div className="font-mono-brand uppercase text-[11px] tracking-[1.2px] text-body-mid">
        {label}
      </div>
    </div>
  );
}

export default function Landing({ onLaunch }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    getStatus().then(setStatus).catch(() => {});
  }, []);

  const quarantineCount = Array.isArray(status?.quarantined) ? status.quarantined.length : null;

  return (
    <div className="bg-canvas text-ink">
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div className="grid-bg absolute inset-0 pointer-events-none" />
        <div
          className="drift-glow absolute -top-40 -right-40 w-[560px] h-[560px] rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
        />
        <div
          className="drift-glow absolute -bottom-40 -left-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ background: "radial-gradient(circle, #ff7a17, transparent 70%)", animationDelay: "4s" }}
        />
        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-28 md:pt-36 md:pb-36">
          <Reveal>
            <Eyebrow>Cognition &amp; Brand Memory Engine</Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display font-normal text-[44px] leading-[1.05] tracking-[-1.4px] md:text-[76px] md:leading-[1.02] md:tracking-[-2.2px] max-w-3xl">
              Every brand sounds
              <br />
              like AI now. <span className="text-body-mid">LOCI doesn't let yours.</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <GradientLine width="180px" className="mt-6" />
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-body">
              A context and memory pipeline that forces a language model to write in one
              brand's exact voice — sourced from that brand's real style guide, defended
              against poisoned input, and scored on whether it actually told the truth.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <button
                onClick={onLaunch}
                className="px-5 py-2.5 rounded-pill bg-ink text-canvas text-sm font-display hover:bg-ink-hover transition-colors"
              >
                Launch the demo
              </button>
              <a
                href="#architecture"
                className="px-5 py-2.5 rounded-pill border border-white/25 text-ink text-sm font-display hover:bg-white/5 hover:border-white/40 transition-colors"
              >
                See the architecture
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- TICKER ---------- */}
      <BuzzwordTicker />

      {/* ---------- LIVE STATS ---------- */}
      <section className="border-b border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
          <Reveal>
            <StatBlock value={status ? status.clean_chunks : "—"} label="Clean chunks indexed" accent="#ffffff" />
          </Reveal>
          <Reveal delay={60}>
            <StatBlock value={status ? status.rules_count : "—"} label="Rules extracted" accent="#a0c3ec" />
          </Reveal>
          <Reveal delay={120}>
            <StatBlock value={quarantineCount ?? "—"} label="Injection attempts neutralized" accent="#ff7a17" />
          </Reveal>
          <Reveal delay={180}>
            <StatBlock value="3" label="Real bugs found under test" accent="#c4b5fd" />
          </Reveal>
        </div>
      </section>

      {/* ---------- PROBLEM ---------- */}
      <section className="border-b border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <Reveal>
            <Eyebrow>The Problem</Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display font-normal text-3xl md:text-[44px] leading-[1.1] tracking-[-1px] max-w-2xl">
              General-purpose models drift toward the same generic voice. Great brands
              can't afford to.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-body-mid">
              Ask any general model for marketing copy and you get the same buzzwords
              every brand is now using — "revolutionary," "seamless," "unlock your
              potential." It has no memory of what a specific brand actually sounds
              like, what it's forbidden to say, or what it's allowed to claim without
              proof. LOCI is the layer that gives it that memory.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------- ARCHITECTURE ---------- */}
      <section id="architecture" className="border-b border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <Reveal>
            <Eyebrow>The Architecture</Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display font-normal text-3xl md:text-[44px] leading-[1.1] tracking-[-1px] max-w-2xl mb-14">
              Five stages. The first two run once; the rest run on every question.
            </h2>
          </Reveal>

          <div className="relative pl-10 md:pl-14">
            <div className="absolute left-[15px] md:left-[19px] top-3 bottom-3 w-px bg-hairline overflow-hidden">
              <div className="flow-dot" style={{ animationDelay: "0s" }} />
              <div className="flow-dot" style={{ animationDelay: "1.2s" }} />
              <div className="flow-dot" style={{ animationDelay: "2.4s" }} />
            </div>
            <div className="flex flex-col gap-4">
              {STAGES.map((s, i) => (
                <Reveal key={s.n} delay={i * 70}>
                  <div className="relative rounded-sm border border-hairline bg-canvas-card p-7 md:p-8 flex flex-col md:flex-row gap-6 md:gap-10">
                    <div
                      className="absolute -left-10 md:-left-14 top-8 w-7 h-7 rounded-full border border-hairline bg-canvas flex items-center justify-center font-mono-brand text-[11px] text-body-mid"
                    >
                      {s.n}
                    </div>
                    <div className="flex-1">
                    <h3 className="font-display font-normal text-xl md:text-2xl tracking-[-0.4px] mb-2.5">
                      {s.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-body-mid mb-4 max-w-2xl">
                      {s.body}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {s.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2.5 py-1 rounded-pill border border-hairline text-[11px] font-mono-brand tracking-[0.6px] text-body-mid"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- SEE IT THINK ---------- */}
      <section className="border-b border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <Reveal>
            <Eyebrow>See It Think</Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display font-normal text-3xl md:text-[44px] leading-[1.1] tracking-[-1px] max-w-2xl mb-5">
              A real trace. A real API call.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="max-w-2xl text-[15px] leading-relaxed text-body-mid mb-12">
              The terminal on the left is an actual captured run — not a mockup script.
              The guide genuinely has no specs for that product, so the critic genuinely
              fails it, fetches more context, and the grounding check still catches an
              unsupported citation on the second pass. On the right: exactly how to call
              the same endpoint yourself.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal delay={180}>
              <TraceTerminal />
            </Reveal>
            <Reveal delay={240}>
              <CodeSnippet />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- LIVE GRAPH ---------- */}
      <section className="border-b border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <Reveal>
            <Eyebrow>The Memory, Live</Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display font-normal text-3xl md:text-[44px] leading-[1.1] tracking-[-1px] max-w-2xl mb-5">
              Not a diagram. The actual graph, right now.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="max-w-2xl text-[15px] leading-relaxed text-body-mid mb-10">
              This is the real rule graph built from Barco's guidelines, fetched live from{" "}
              <code className="text-body">/api/graph</code> — force-directed, redrawn every frame. Zoom
              into a term like <code className="text-body">colour</code> and follow its edge to{" "}
              <code className="text-body">color</code>.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <GraphView />
          </Reveal>
        </div>
      </section>

      {/* ---------- DIFFERENTIATORS ---------- */}
      <section className="border-b border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <Reveal>
            <Eyebrow>What Makes This Different</Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display font-normal text-3xl md:text-[44px] leading-[1.1] tracking-[-1px] max-w-2xl mb-14">
              Not a RAG chatbot with a rebrand.
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-5">
            {DIFFERENTIATORS.map((d, i) => (
              <Reveal key={d.title} delay={i * 70}>
                <div className="h-full rounded-sm border border-hairline bg-canvas-card p-7">
                  <h3 className="font-display font-normal text-lg mb-2.5">{d.title}</h3>
                  <p className="text-[14.5px] leading-relaxed text-body-mid">{d.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- STACK ---------- */}
      <section className="border-b border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <Reveal>
            <Eyebrow>Built With</Eyebrow>
          </Reveal>
          <Reveal delay={60}>
            <div className="flex flex-wrap gap-2.5">
              {STACK.map((t) => (
                <span
                  key={t}
                  className="px-3.5 py-1.5 rounded-pill border border-hairline text-[13px] font-display text-body"
                >
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 max-w-2xl text-[13.5px] leading-relaxed text-body-mid">
              Runs fully locally — the language model is invoked through Claude Code's
              headless mode instead of a separate paid API, and retrieval is plain
              keyword search instead of an embedding model, on purpose: both are
              deliberate fits for the problem, not shortcuts.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section>
        <div className="max-w-5xl mx-auto px-6 py-28 flex flex-col items-start">
          <Reveal>
            <h2 className="font-display font-normal text-3xl md:text-[52px] leading-[1.05] tracking-[-1.4px] max-w-2xl">
              Watch it catch its own mistake.
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-body-mid">
              Ask it to announce a product it has no real specs for — the loop is built
              to flag that, not paper over it.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <button
              onClick={onLaunch}
              className="mt-8 px-5 py-2.5 rounded-pill bg-ink text-canvas text-sm font-display hover:bg-ink-hover transition-colors"
            >
              Launch the demo
            </button>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-3 text-body-mid text-xs">
          <span className="font-mono-brand uppercase tracking-[1.2px]">LOCI</span>
          <span>Cognition &amp; Brand Memory Engine — built for a hackathon, running fully local.</span>
        </div>
      </footer>
    </div>
  );
}
