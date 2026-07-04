export default function StatusStrip({ status, error }) {
  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-sm border border-hairline bg-canvas-card text-[#ff9a8a] text-xs">
        Backend unreachable — {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-sm border border-hairline bg-canvas-card text-body-mid text-xs">
        <span className="w-2 h-2 rounded-full bg-body-mid pulse-dot" /> Loading ingestion status…
      </div>
    );
  }

  const quarantineCount = Array.isArray(status.quarantined) ? status.quarantined.length : 0;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-sm border border-hairline bg-canvas-card text-xs">
      <span className="flex items-center gap-1.5 text-body-mid">
        <span className="w-2 h-2 rounded-full" style={{ background: "#a0c3ec" }} />
        <span className="text-ink font-medium">{status.clean_chunks ?? "—"}</span> clean chunks
      </span>
      <span className="text-hairline">•</span>
      <span className="text-body-mid">
        <span className="text-ink font-medium">{status.rules_count ?? "—"}</span> rules extracted
      </span>
      <span className="text-hairline">•</span>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill font-medium border ${
          quarantineCount > 0
            ? "text-sunset-soft border-sunset/40"
            : "text-body-mid border-hairline"
        }`}
        style={quarantineCount > 0 ? { background: "rgba(255,122,23,0.1)" } : undefined}
      >
        {quarantineCount > 0 ? "⚠" : "✓"} {quarantineCount} injection attempt{quarantineCount === 1 ? "" : "s"} neutralized
      </span>
    </div>
  );
}
