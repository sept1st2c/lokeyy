// A real trace captured from an actual run against the live backend this
// session (query: "Write a two-sentence LinkedIn post announcing our new
// UniSee II display") -- not a fabricated demo, the guide genuinely has no
// specs for that product, so the loop genuinely catches it.
const LINES = [
  { t: "retrieve", tag: "done", detail: "pulled chunk-18, chunk-11, chunk-7 · 17 rules", color: "#a0c3ec" },
  { t: "draft", tag: "done", detail: '"Barco introduces the UniSee II, our next-gen display…"', color: "#c4b5fd" },
  { t: "critique #1", tag: "FAIL", detail: "confidence 60% · citation acc. 0% · insufficient_context", color: "#ff9a8a" },
  { t: "fetch_more", tag: "done", detail: "insufficient_context → widened retrieval, k=3 → 6", color: "#ffc285" },
  { t: "refine", tag: "done", detail: 'rewrote with citation [chunk-7]', color: "#7ee787" },
  { t: "critique #2", tag: "PASS", detail: "confidence 92% · citation acc. 100% (unverified)", color: "#7ee787" },
  { t: "grounding_check", tag: "FAIL", detail: "chunk-7 does not actually support the claim → overridden", color: "#ff9a8a" },
];

const TAG_STYLE = {
  done: { color: "#7ee787", bg: "rgba(126,231,135,0.1)" },
  PASS: { color: "#7ee787", bg: "rgba(126,231,135,0.1)" },
  FAIL: { color: "#ff9a8a", bg: "rgba(255,154,138,0.1)" },
};

export default function TraceTerminal() {
  return (
    <div className="rounded-sm border border-hairline bg-canvas-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-hairline">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 font-mono-brand text-[11px] tracking-[0.6px] text-body-mid">
          loci · query · unisee-ii-announcement
        </span>
      </div>
      <div className="px-4 py-4 font-mono-brand text-[12.5px] leading-[1.9]">
        {LINES.map((line, i) => {
          const style = TAG_STYLE[line.tag];
          return (
            <div key={i} className="flex items-start gap-2.5 flex-wrap">
              <span className="text-body-mid/50 select-none">{String(i + 1).padStart(2, "0")}</span>
              <span style={{ color: line.color }} className="font-medium shrink-0">
                {line.t}
              </span>
              <span
                className="px-1.5 rounded text-[10px] font-medium shrink-0"
                style={{ color: style.color, background: style.bg }}
              >
                [{line.tag}]
              </span>
              <span className="text-body-mid basis-full pl-[52px] -mt-0.5 text-[12px] leading-[1.6]">
                {line.detail}
              </span>
            </div>
          );
        })}
        <div className="mt-3 pt-3 border-t border-hairline text-body-mid/70 text-[11.5px]">
          <span className="text-body">passes: false</span> · final_confidence:{" "}
          <span style={{ color: "#ff9a8a" }}>25%</span> · citation_accuracy:{" "}
          <span style={{ color: "#ff9a8a" }}>4%</span>
          <span className="blink-cursor" />
        </div>
      </div>
    </div>
  );
}
