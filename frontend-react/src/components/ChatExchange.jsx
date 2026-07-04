import CitedText from "./CitedText.jsx";
import ScoreRow from "./ScoreRow.jsx";
import ThoughtProcess from "./ThoughtProcess.jsx";

export default function ChatExchange({ exchange }) {
  const { query, response, error, loading } = exchange;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* user bubble */}
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-sm bg-ink text-canvas text-sm">
          {query}
        </div>
      </div>

      {/* assistant bubble */}
      <div className="flex justify-start">
        <div className="max-w-[85%] w-full space-y-3">
          <div className="px-4 py-3 rounded-sm bg-canvas-card border border-hairline text-sm text-ink">
            {loading ? (
              <div className="flex items-center gap-2 text-body-mid">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-body-mid pulse-dot" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-body-mid pulse-dot" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-body-mid pulse-dot" style={{ animationDelay: "300ms" }} />
                </span>
                Thinking through brand guidelines…
              </div>
            ) : error ? (
              <div className="text-[#ff9a8a]">Error: {error}</div>
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
                <div
                  className="px-4 py-2.5 rounded-sm border text-xs"
                  style={{ borderColor: "rgba(255,154,138,0.3)", background: "rgba(255,154,138,0.06)", color: "#ff9a8a" }}
                >
                  <span className="font-medium">Violations: </span>
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
