import { useState } from "react";
import CitedText from "./CitedText.jsx";

const STEP_META = {
  retrieve: { label: "Retrieve", color: "text-sky-300", dot: "bg-sky-400" },
  draft: { label: "Draft", color: "text-violet-300", dot: "bg-violet-400" },
  fetch_more: { label: "Fetch More", color: "text-amber-300", dot: "bg-amber-400" },
  critique: { label: "Critique", color: "text-fuchsia-300", dot: "bg-fuchsia-400" },
  refine: { label: "Refine", color: "text-teal-300", dot: "bg-teal-400" },
};

function StepBody({ step, sourcesCited }) {
  switch (step.step) {
    case "retrieve":
      return (
        <div className="text-sm text-slate-400">
          <div>
            Pulled <span className="text-slate-200 font-medium">{step.chunks_used?.length ?? 0}</span> chunks,{" "}
            <span className="text-slate-200 font-medium">{step.rules_used ?? 0}</span> rules
          </div>
          {step.chunks_used?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {step.chunks_used.map((c) => (
                <span
                  key={c}
                  className="px-1.5 py-0.5 rounded-full border border-slate-700 bg-slate-800/80 text-[11px] font-mono text-slate-300"
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
        <pre className="whitespace-pre-wrap break-words text-sm font-mono bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-slate-300">
          <CitedText text={step.text} sourcesCited={sourcesCited} />
        </pre>
      );
    case "fetch_more":
      return (
        <div className="text-sm">
          <div className="text-amber-300/90 mb-1.5">Reason: {step.reason}</div>
          {step.new_chunks_used?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {step.new_chunks_used.map((c) => (
                <span
                  key={c}
                  className="px-1.5 py-0.5 rounded-full border border-amber-700/50 bg-amber-500/10 text-[11px] font-mono text-amber-300"
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
            <span className="text-slate-400">Attempt {step.attempt}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                r.passes
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/40"
              }`}
            >
              {r.passes ? "PASS" : "FAIL"}
            </span>
            {typeof r.confidence === "number" && (
              <span className="text-slate-500 text-xs">confidence {r.confidence}%</span>
            )}
            {typeof r.citation_accuracy === "number" && (
              <span className="text-slate-500 text-xs">citation acc. {r.citation_accuracy}%</span>
            )}
          </div>
          {r.failure_reason && <div className="text-rose-300/80 italic">{r.failure_reason}</div>}
          {r.violations?.length > 0 && (
            <ul className="list-disc list-inside text-rose-300/80 space-y-0.5">
              {r.violations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          )}
          {step.citation_check && (
            <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-slate-800/80">
              <span>cited: {step.citation_check.cited?.join(", ") || "none"}</span>
              {step.citation_check.fabricated?.length > 0 && (
                <span className="text-rose-400">
                  fabricated: {step.citation_check.fabricated.join(", ")}
                </span>
              )}
              <span className={step.citation_check.all_valid ? "text-emerald-400" : "text-rose-400"}>
                {step.citation_check.all_valid ? "all citations valid" : "invalid citations found"}
              </span>
            </div>
          )}
        </div>
      );
    }
    default:
      return (
        <pre className="text-xs font-mono text-slate-500 whitespace-pre-wrap break-words">
          {JSON.stringify(step, null, 2)}
        </pre>
      );
  }
}

export default function ThoughtProcess({ trace = [], sourcesCited = [] }) {
  const [open, setOpen] = useState(true);

  if (!trace || trace.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden animate-fade-in">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          Thought Process
          <span className="text-xs font-normal text-slate-500">({trace.length} steps)</span>
        </span>
        <span
          className={`text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
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
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-800" />
              {trace.map((step, i) => {
                const meta = STEP_META[step.step] || {
                  label: step.step,
                  color: "text-slate-300",
                  dot: "bg-slate-500",
                };
                return (
                  <div key={i} className="relative">
                    <div className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full ${meta.dot} ring-4 ring-slate-900`} />
                    <div className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${meta.color}`}>
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
