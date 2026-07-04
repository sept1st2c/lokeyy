import { useEffect, useRef, useState } from "react";
import { addWebSource, clearWebSources } from "../lib/api.js";

const TIER_STYLES = {
  A: { color: "#7ee787", border: "rgba(126,231,135,0.35)", bg: "rgba(126,231,135,0.08)" },
  B: { color: "#ffc285", border: "rgba(255,194,133,0.35)", bg: "rgba(255,194,133,0.08)" },
  C: { color: "#a0a5ad", border: "var(--color-hairline)", bg: "rgba(255,255,255,0.03)" },
};

// Real stages of what's actually happening server-side, cycled while
// waiting -- there's no live progress feed from the backend (it's one
// synchronous call), so this is honest about being an estimate, not a
// real-time status, while still proving the app hasn't frozen on a call
// that can genuinely take 1-3 minutes.
const SEARCH_STAGES = [
  { at: 0, text: "Searching the web for real voice/tone guidance…" },
  { at: 15, text: "Fetching the most relevant page found…" },
  { at: 35, text: "Extracting brand-voice rules from the fetched content…" },
  { at: 60, text: "Rebuilding the knowledge graph with the new rules…" },
  { at: 100, text: "Still working — some brands take longer than others, hang tight…" },
];

function useElapsedSeconds(active) {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      startRef.current = null;
      return;
    }
    startRef.current = performance.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((performance.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return seconds;
}

function Spinner() {
  return (
    <span className="inline-flex gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

export default function SourcesPanel({ sources, onSourcesChanged }) {
  const [notice, setNotice] = useState(null);
  const [brandInput, setBrandInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const elapsed = useElapsedSeconds(busy);

  useEffect(() => {
    if (!busy) return;
    const stage = [...SEARCH_STAGES].reverse().find((s) => elapsed >= s.at);
    if (stage) setBusyLabel(stage.text);
  }, [busy, elapsed]);

  const webSources = (sources ?? []).filter((s) => s.provenance === "web");

  function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNotice({
      tone: "warn",
      text:
        `"${file.name}" was not ingested — PDF upload isn't wired up in this build yet. ` +
        `Use "Search a brand" below instead, or wait for one of the vetted sources.`,
    });
  }

  async function handleSearchBrand() {
    const brand = brandInput.trim();
    if (!brand || busy) return;
    setBusy(true);
    setBusyLabel(SEARCH_STAGES[0].text);
    setNotice(null);
    try {
      const result = await addWebSource(brand);
      setBrandInput("");
      setNotice({
        tone: "ok",
        text: `Added "${result.added}" from ${result.fetched_url} — tier B (web-sourced, not manually vetted). ${result.status.rules_count} rules now in the graph.`,
      });
      onSourcesChanged?.();
    } catch (e) {
      setNotice({ tone: "warn", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleClearWeb() {
    if (busy) return;
    setBusy(true);
    setBusyLabel("Clearing web-sourced documents and rebuilding the graph…");
    setNotice(null);
    try {
      const result = await clearWebSources();
      setNotice({ tone: "ok", text: `Removed ${result.removed} web source(s). ${result.status.rules_count} rules remain.` });
      onSourcesChanged?.();
    } catch (e) {
      setNotice({ tone: "warn", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const noticeStyle =
    notice?.tone === "ok"
      ? { borderColor: "rgba(126,231,135,0.35)", background: "rgba(126,231,135,0.06)", color: "#7ee787" }
      : { borderColor: "rgba(255,194,133,0.35)", background: "rgba(255,194,133,0.06)", color: "#ffc285" };

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono-brand uppercase text-[10px] tracking-[1.2px] text-body-mid">
          Brand sources
        </span>
        {(sources ?? []).map((s) => {
          const style = TIER_STYLES[s.tier] ?? TIER_STYLES.C;
          const icon = s.provenance === "web" ? "🌐" : "✓";
          return (
            <span
              key={s.filename}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill border font-medium"
              style={{ color: style.color, borderColor: style.border, background: style.bg }}
              title={`${s.chunk_count} chunk${s.chunk_count === 1 ? "" : "s"} ingested · ${s.provenance}`}
            >
              {icon} {s.filename} <span className="opacity-70">· Tier {s.tier}</span>
            </span>
          );
        })}
        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill border border-dashed border-hairline text-body-mid hover:text-ink hover:border-white/30 cursor-pointer transition-colors">
          + Upload PDF
          <input type="file" accept=".pdf" className="hidden" onChange={handleFilePicked} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={brandInput}
          onChange={(e) => setBrandInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearchBrand()}
          placeholder="Search a brand (e.g. Nike, Mailchimp)…"
          disabled={busy}
          className="px-3 py-1.5 rounded-pill bg-canvas-soft border border-hairline text-xs text-ink placeholder-body-mid focus:outline-none focus:border-white/30 transition-colors disabled:opacity-50 w-56"
        />
        <button
          onClick={handleSearchBrand}
          disabled={busy || !brandInput.trim()}
          className="px-3 py-1.5 rounded-pill bg-ink text-canvas text-xs font-medium disabled:bg-canvas-mid disabled:text-body-mid disabled:cursor-not-allowed transition-colors"
        >
          {busy ? <Spinner /> : "🔍 Search"}
        </button>
        {webSources.length > 0 && (
          <button
            onClick={handleClearWeb}
            disabled={busy}
            className="px-3 py-1.5 rounded-pill border border-hairline text-body-mid hover:text-ink hover:border-white/30 text-xs transition-colors disabled:opacity-50"
          >
            Clear web sources ({webSources.length})
          </button>
        )}
      </div>

      {busy && (
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-sm border text-[11px]"
          style={{ borderColor: "rgba(160,195,236,0.3)", background: "rgba(160,195,236,0.06)", color: "#a0c3ec" }}
        >
          <Spinner />
          <span className="flex-1">{busyLabel}</span>
          <span className="font-mono-brand tabular-nums text-body-mid">{elapsed}s elapsed</span>
        </div>
      )}

      {!busy && notice && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-sm border text-[11px]"
          style={noticeStyle}
        >
          <span>{notice.tone === "ok" ? "✓" : "⚠"}</span>
          <span className="flex-1">{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            className="opacity-70 hover:opacity-100 leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
