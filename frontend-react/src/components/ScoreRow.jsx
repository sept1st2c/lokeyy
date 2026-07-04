function Meter({ label, value }) {
  const v = typeof value === "number" ? Math.max(0, Math.min(100, value)) : null;
  const color = v === null ? "#363a3f" : v >= 80 ? "#7ee787" : v >= 50 ? "#ffc285" : "#ff9a8a";

  return (
    <div className="flex-1 min-w-[160px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono-brand uppercase text-[10px] tracking-[1.2px] text-body-mid">{label}</span>
        <span className="text-sm font-medium text-ink tabular-nums">
          {v === null ? "—" : `${v}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-pill bg-canvas-mid overflow-hidden">
        <div
          className="h-full rounded-pill transition-all duration-700 ease-out"
          style={{ width: `${v ?? 0}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function ScoreRow({ confidence, citationAccuracy, passes }) {
  return (
    <div className="flex flex-wrap items-center gap-5 p-4 rounded-sm border border-hairline bg-canvas-card animate-fade-in">
      <Meter label="Confidence" value={confidence} />
      <Meter label="Citation Accuracy" value={citationAccuracy} />
      <div className="flex flex-col items-start gap-1.5">
        <span className="font-mono-brand uppercase text-[10px] tracking-[1.2px] text-body-mid">Result</span>
        <span
          className="px-3 py-1 rounded-pill text-xs font-medium border"
          style={
            passes
              ? { color: "#7ee787", borderColor: "rgba(126,231,135,0.4)", background: "rgba(126,231,135,0.1)" }
              : { color: "#ff9a8a", borderColor: "rgba(255,154,138,0.4)", background: "rgba(255,154,138,0.1)" }
          }
        >
          {passes ? "PASS" : "FAIL"}
        </span>
      </div>
    </div>
  );
}
