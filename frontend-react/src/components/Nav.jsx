export default function Nav({ view, onNavigate, tab, onTabChange }) {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <button
          onClick={() => onNavigate("home")}
          className="flex items-center gap-2.5 shrink-0"
        >
          <span className="w-7 h-7 rounded-full border border-hairline flex items-center justify-center text-ink font-display text-xs tracking-[-1px]">
            L
          </span>
          <span className="font-mono-brand uppercase text-[11px] tracking-[1.4px] text-body-mid">
            LOCI
          </span>
        </button>

        {view === "app" && (
          <div className="flex items-center gap-1 border border-hairline rounded-pill p-1 bg-canvas-soft/60">
            <button
              onClick={() => onTabChange("query")}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-display transition-colors ${
                tab === "query" ? "bg-ink text-canvas" : "text-body-mid hover:text-ink"
              }`}
            >
              Query
            </button>
            <button
              onClick={() => onTabChange("graph")}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-display transition-colors ${
                tab === "graph" ? "bg-ink text-canvas" : "text-body-mid hover:text-ink"
              }`}
            >
              Knowledge Graph
            </button>
          </div>
        )}

        <button
          onClick={() => onNavigate(view === "home" ? "app" : "home")}
          className="shrink-0 px-4 py-2 rounded-pill border border-white/25 text-ink text-xs font-display hover:bg-white/5 hover:border-white/40 transition-colors"
        >
          {view === "home" ? "Launch Demo" : "Back to Home"}
        </button>
      </div>
    </header>
  );
}
