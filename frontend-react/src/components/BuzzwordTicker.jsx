const BUZZWORDS = [
  "seamless", "revolutionary", "unlock your potential", "game-changing",
  "industry-leading", "next-level", "cutting-edge", "synergy", "disrupt",
  "best-in-class", "unparalleled", "world-class", "state-of-the-art",
];

export default function BuzzwordTicker() {
  const items = [...BUZZWORDS, ...BUZZWORDS];
  return (
    <div className="relative overflow-hidden border-y border-hairline bg-canvas-soft/30 py-4">
      <div className="marquee-track flex items-center gap-12 whitespace-nowrap">
        {items.map((w, i) => (
          <span
            key={i}
            className="font-mono-brand uppercase text-[13px] tracking-[1.2px] text-body-mid/60 line-through"
          >
            {w}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-canvas to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-canvas to-transparent" />
    </div>
  );
}
