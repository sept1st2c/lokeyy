const TIER_STYLES = {
  A: { color: "#7ee787", border: "rgba(126,231,135,0.35)", bg: "rgba(126,231,135,0.08)" },
  B: { color: "#ffc285", border: "rgba(255,194,133,0.35)", bg: "rgba(255,194,133,0.08)" },
  C: { color: "#a0a5ad", border: "var(--color-hairline)", bg: "rgba(255,255,255,0.03)" },
  default: { color: "#a0c3ec", border: "rgba(160,195,236,0.35)", bg: "rgba(160,195,236,0.08)" },
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
            className="inline-flex items-center mx-0.5 px-1.5 py-0.5 rounded-pill border text-[11px] font-mono-brand font-medium align-middle"
            style={{ color: style.color, borderColor: style.border, background: style.bg }}
            title={tier ? `Tier ${tier} source` : "Source citation"}
          >
            {id}
          </span>
        );
      })}
    </span>
  );
}
