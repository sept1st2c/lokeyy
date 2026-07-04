import { useState } from "react";

const TIER_STYLES = {
  A: { color: "#7ee787", border: "rgba(126,231,135,0.35)", bg: "rgba(126,231,135,0.08)" },
  B: { color: "#ffc285", border: "rgba(255,194,133,0.35)", bg: "rgba(255,194,133,0.08)" },
  C: { color: "#a0a5ad", border: "var(--color-hairline)", bg: "rgba(255,255,255,0.03)" },
};

export default function SourcesPanel({ sources }) {
  const [notice, setNotice] = useState(null);

  function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNotice(
      `"${file.name}" was not ingested — PDF upload isn't wired up in this build yet. ` +
        `Right now the API only serves the pre-processed brand sources below. Check back soon!`
    );
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono-brand uppercase text-[10px] tracking-[1.2px] text-body-mid">
          Brand sources
        </span>
        {(sources ?? []).map((s) => {
          const style = TIER_STYLES[s.tier] ?? TIER_STYLES.C;
          return (
            <span
              key={s.filename}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill border font-medium"
              style={{ color: style.color, borderColor: style.border, background: style.bg }}
              title={`${s.chunk_count} chunk${s.chunk_count === 1 ? "" : "s"} ingested`}
            >
              ✓ {s.filename} <span className="opacity-70">· Tier {s.tier}</span>
            </span>
          );
        })}
        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill border border-dashed border-hairline text-body-mid hover:text-ink hover:border-white/30 cursor-pointer transition-colors">
          + Upload PDF
          <input type="file" accept=".pdf" className="hidden" onChange={handleFilePicked} />
        </label>
      </div>
      {notice && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-sm border text-[11px]"
          style={{ borderColor: "rgba(255,194,133,0.35)", background: "rgba(255,194,133,0.06)", color: "#ffc285" }}
        >
          <span>⚠</span>
          <span className="flex-1">{notice}</span>
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
