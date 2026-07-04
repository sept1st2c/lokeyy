import { useEffect, useRef, useState } from "react";
import { postQuery, getStatus } from "./lib/api.js";
import StatusStrip from "./components/StatusStrip.jsx";
import ChatExchange from "./components/ChatExchange.jsx";
import GraphView from "./components/GraphView.jsx";

function App() {
  const [tab, setTab] = useState("query"); // query | graph
  const [input, setInput] = useState("");
  const [exchanges, setExchanges] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch((e) => setStatusError(e.message));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [exchanges]);

  async function submitQuery() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const idx = exchanges.length;
    setExchanges((prev) => [...prev, { query: q, loading: true }]);

    try {
      const response = await postQuery(q);
      setExchanges((prev) => {
        const next = [...prev];
        next[idx] = { query: q, response, loading: false };
        return next;
      });
      // refresh status after each query (quarantine/rule counts may change)
      getStatus().then(setStatus).catch(() => {});
    } catch (e) {
      setExchanges((prev) => {
        const next = [...prev];
        next[idx] = { query: q, error: e.message, loading: false };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuery();
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0c10]">
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
              L
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-100 leading-tight">LOCI</h1>
              <p className="text-[11px] text-slate-500 leading-tight">Cognition &amp; Brand Memory Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-slate-900/70 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setTab("query")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === "query" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Query
            </button>
            <button
              onClick={() => setTab("graph")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === "graph" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Knowledge Graph
            </button>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <StatusStrip status={status} error={statusError} />
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {tab === "graph" ? (
          <GraphView />
        ) : (
          <>
            {exchanges.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-slate-500 gap-2">
                <div className="text-3xl mb-1">◆</div>
                <p className="text-sm">Ask something about the brand's visual identity guidelines.</p>
                <p className="text-xs text-slate-600">e.g. "What is the minimum logo clear space?"</p>
              </div>
            )}
            <div className="flex flex-col gap-8">
              {exchanges.map((ex, i) => (
                <ChatExchange key={i} exchange={ex} />
              ))}
              <div ref={scrollRef} />
            </div>
          </>
        )}
      </main>

      {tab === "query" && (
        <div className="sticky bottom-0 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur">
          <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about brand guidelines…"
              disabled={busy}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-600/60 focus:border-sky-600/60 transition-all disabled:opacity-50"
            />
            <button
              onClick={submitQuery}
              disabled={busy || !input.trim()}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {busy ? "…" : "Ask"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
