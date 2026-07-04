const TIER_STYLES = {
  A: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  B: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  C: "bg-slate-500/15 text-slate-300 border-slate-500/40",
  default: "bg-sky-500/15 text-sky-300 border-sky-500/40",
};

// Splits text on [chunk-N] style markers and renders each as a small pill,
// colored by tier if we have tier info from sources_cited.
export default function CitedText({ text, sourcesCited = [], className = "" }) {
  if (!text) return null;

  const tierById = {};
  for (const s of sourcesCited) {
    if (typeof s === "string") {
      tierById[s] = null;
    } else if (s && typeof s === "object") {
      tierById[s.id] = s.tier;
    }
  }

  const parts = text.split(/(\[[\w-]+\])/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const match = part.match(/^\[([\w-]+)\]$/);
        if (!match) return <span key={i}>{part}</span>;
        const id = match[1];
        const tier = tierById[id];
        const style = TIER_STYLES[tier] || TIER_STYLES.default;
        return (
          <span
            key={i}
            className={`inline-flex items-center mx-0.5 px-1.5 py-0.5 rounded-full border text-[11px] font-mono font-medium align-middle ${style}`}
            title={tier ? `Tier ${tier} source` : "Source citation"}
          >
            {id}
          </span>
        );
      })}
    </span>
  );
}
