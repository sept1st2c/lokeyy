export default function StatusStrip({ status, error }) {
  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-rose-800/50 bg-rose-950/30 text-rose-300 text-xs">
        Backend unreachable — {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-500 text-xs">
        <span className="w-2 h-2 rounded-full bg-slate-600 pulse-dot" /> Loading ingestion status…
      </div>
    );
  }

  const quarantineCount = Array.isArray(status.quarantined) ? status.quarantined.length : 0;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-900/40 text-xs">
      <span className="flex items-center gap-1.5 text-slate-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-slate-200 font-semibold">{status.clean_chunks ?? "—"}</span> clean chunks
      </span>
      <span className="text-slate-700">•</span>
      <span className="text-slate-400">
        <span className="text-slate-200 font-semibold">{status.rules_count ?? "—"}</span> rules extracted
      </span>
      <span className="text-slate-700">•</span>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold border ${
          quarantineCount > 0
            ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
            : "bg-slate-800/60 text-slate-500 border-slate-700"
        }`}
      >
        {quarantineCount > 0 ? "⚠" : "✓"} {quarantineCount} injection attempt{quarantineCount === 1 ? "" : "s"} neutralized
      </span>
    </div>
  );
}
