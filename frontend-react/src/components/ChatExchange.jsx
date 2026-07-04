import CitedText from "./CitedText.jsx";
import ScoreRow from "./ScoreRow.jsx";
import ThoughtProcess from "./ThoughtProcess.jsx";

export default function ChatExchange({ exchange }) {
  const { query, response, error, loading } = exchange;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* user bubble */}
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-sky-600/90 text-white text-sm shadow-sm">
          {query}
        </div>
      </div>

      {/* assistant bubble */}
      <div className="flex justify-start">
        <div className="max-w-[85%] w-full space-y-3">
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-slate-800/80 border border-slate-700/60 text-sm text-slate-100 shadow-sm">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 pulse-dot" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 pulse-dot" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 pulse-dot" style={{ animationDelay: "300ms" }} />
                </span>
                Thinking through brand guidelines…
              </div>
            ) : error ? (
              <div className="text-rose-300">Error: {error}</div>
            ) : (
              <CitedText text={response.final_answer} sourcesCited={response.sources_cited} className="leading-relaxed" />
            )}
          </div>

          {!loading && !error && response && (
            <>
              <ScoreRow
                confidence={response.confidence}
                citationAccuracy={response.citation_accuracy}
                passes={response.passes}
              />
              {response.violations?.length > 0 && (
                <div className="px-4 py-2.5 rounded-lg border border-rose-800/40 bg-rose-950/20 text-xs text-rose-300">
                  <span className="font-semibold">Violations: </span>
                  {response.violations.join("; ")}
                </div>
              )}
              <ThoughtProcess trace={response.trace} sourcesCited={response.sources_cited} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
