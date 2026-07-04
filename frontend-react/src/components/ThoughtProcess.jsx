import { useState } from "react";
import CitedText from "./CitedText.jsx";

const STEP_META = {
  retrieve: { label: "Retrieve", color: "#a0c3ec" },
  draft: { label: "Draft", color: "#c4b5fd" },
  fetch_more: { label: "Fetch More", color: "#ffc285" },
  critique: { label: "Critique", color: "#e0a0e8" },
  refine: { label: "Refine", color: "#7ee787" },
  grounding_check: { label: "Grounding Check", color: "#7ee787" },
};

function StepBody({ step, sourcesCited }) {
  switch (step.step) {
    case "retrieve":
      return (
        <div className="text-sm text-body-mid">
          <div>
            Pulled <span className="text-ink font-medium">{step.chunks_used?.length ?? 0}</span> chunks,{" "}
            <span className="text-ink font-medium">{step.rules_used ?? 0}</span> rules
          </div>
          {step.chunks_used?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {step.chunks_used.map((c) => (
                <span
                  key={c}
                  className="px-1.5 py-0.5 rounded-pill border border-hairline bg-canvas-soft text-[11px] font-mono-brand text-body"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    case "draft":
    case "refine":
      return (
        <pre className="whitespace-pre-wrap break-words text-sm font-mono-brand bg-canvas border border-hairline rounded-sm p-3 text-body">
          <CitedText text={step.text} sourcesCited={sourcesCited} />
        </pre>
      );
    case "fetch_more":
      return (
        <div className="text-sm">
          <div className="mb-1.5" style={{ color: "#ffc285" }}>
            Reason: {step.reason}
          </div>
          {step.new_chunks_used?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {step.new_chunks_used.map((c) => (
                <span
                  key={c}
                  className="px-1.5 py-0.5 rounded-pill border text-[11px] font-mono-brand"
                  style={{ borderColor: "rgba(255,194,133,0.4)", background: "rgba(255,194,133,0.08)", color: "#ffc285" }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    case "critique": {
      const r = step.result || {};
      return (
        <div className="text-sm space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body-mid">Attempt {step.attempt}</span>
            <span
              className="px-2 py-0.5 rounded-pill text-[11px] font-medium border"
              style={
                r.passes
                  ? { color: "#7ee787", borderColor: "rgba(126,231,135,0.4)", background: "rgba(126,231,135,0.1)" }
                  : { color: "#ff9a8a", borderColor: "rgba(255,154,138,0.4)", background: "rgba(255,154,138,0.1)" }
              }
            >
              {r.passes ? "PASS" : "FAIL"}
            </span>
            {typeof r.confidence === "number" && (
              <span className="text-body-mid text-xs">confidence {r.confidence}%</span>
            )}
            {typeof r.citation_accuracy === "number" && (
              <span className="text-body-mid text-xs">citation acc. {r.citation_accuracy}%</span>
            )}
          </div>
          {r.failure_reason && <div className="italic" style={{ color: "#ff9a8a99" }}>{r.failure_reason}</div>}
          {r.violations?.length > 0 && (
            <ul className="list-disc list-inside space-y-0.5" style={{ color: "#ff9a8acc" }}>
              {r.violations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          )}
          {step.citation_check && (
            <div className="text-xs text-body-mid flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-hairline">
              <span>cited: {step.citation_check.cited?.join(", ") || "none"}</span>
              {step.citation_check.fabricated?.length > 0 && (
                <span style={{ color: "#ff9a8a" }}>
                  fabricated: {step.citation_check.fabricated.join(", ")}
                </span>
              )}
              <span style={{ color: step.citation_check.all_valid ? "#7ee787" : "#ff9a8a" }}>
                {step.citation_check.all_valid ? "all citations valid" : "invalid citations found"}
              </span>
            </div>
          )}
        </div>
      );
    }
    case "grounding_check": {
      const result = step.result;
      if (result === "skipped" || !result) {
        return <div className="text-sm text-body-mid italic">skipped — no citations to check</div>;
      }
      const results = result.results || [];
      return (
        <div className="text-sm space-y-1.5">
          {results.length === 0 && <div className="text-body-mid italic">no citations to check</div>}
          {results.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className="px-1.5 py-0.5 rounded-pill border text-[11px] font-mono-brand shrink-0"
                style={
                  r.supported
                    ? { color: "#7ee787", borderColor: "rgba(126,231,135,0.4)", background: "rgba(126,231,135,0.1)" }
                    : { color: "#ff9a8a", borderColor: "rgba(255,154,138,0.4)", background: "rgba(255,154,138,0.1)" }
                }
              >
                {r.id}
              </span>
              <span className="text-body-mid text-[13px] leading-snug">{r.reason}</span>
            </div>
          ))}
        </div>
      );
    }
    default:
      return (
        <pre className="text-xs font-mono-brand text-body-mid whitespace-pre-wrap break-words">
          {JSON.stringify(step, null, 2)}
        </pre>
      );
  }
}

export default function ThoughtProcess({ trace = [], sourcesCited = [] }) {
  const [open, setOpen] = useState(true);

  if (!trace || trace.length === 0) return null;

  return (
    <div className="rounded-sm border border-hairline bg-canvas-card overflow-hidden animate-fade-in">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="font-mono-brand uppercase text-[11px] tracking-[1.2px] text-ink flex items-center gap-2">
          Thought Process
          <span className="text-[10px] font-normal text-body-mid tracking-normal">({trace.length} steps)</span>
        </span>
        <span
          className={`text-body-mid transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1">
            <div className="relative pl-6 space-y-5">
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-hairline" />
              {trace.map((step, i) => {
                const meta = STEP_META[step.step] || { label: step.step, color: "#9aa0a8" };
                return (
                  <div key={i} className="relative">
                    <div
                      className="absolute -left-6 top-1.5 w-3 h-3 rounded-full ring-4"
                      style={{ background: meta.color, boxShadow: "0 0 0 4px #191919" }}
                    />
                    <div
                      className="font-mono-brand uppercase text-[10px] tracking-[1.2px] mb-1.5"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </div>
                    <StepBody step={step} sourcesCited={sourcesCited} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
