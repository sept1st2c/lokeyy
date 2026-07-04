function Meter({ label, value }) {
  const v = typeof value === "number" ? Math.max(0, Math.min(100, value)) : null;
  const color =
    v === null ? "bg-slate-600" : v >= 80 ? "bg-emerald-400" : v >= 50 ? "bg-amber-400" : "bg-rose-400";

  return (
    <div className="flex-1 min-w-[160px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
        <span className="text-sm font-semibold text-slate-100 tabular-nums">
          {v === null ? "—" : `${v}%`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${v ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export default function ScoreRow({ confidence, citationAccuracy, passes }) {
  return (
    <div className="flex flex-wrap items-center gap-5 p-4 rounded-xl border border-slate-800 bg-slate-900/60 animate-fade-in">
      <Meter label="Confidence" value={confidence} />
      <Meter label="Citation Accuracy" value={citationAccuracy} />
      <div className="flex flex-col items-start gap-1.5">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Result</span>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            passes
              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
              : "bg-rose-500/15 text-rose-300 border-rose-500/40"
          }`}
        >
          {passes ? "PASS" : "FAIL"}
        </span>
      </div>
    </div>
  );
}
