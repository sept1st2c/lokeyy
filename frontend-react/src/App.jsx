import { useEffect, useRef, useState } from "react";
import { postQuery, getStatus } from "./lib/api.js";
import Nav from "./components/Nav.jsx";
import Landing from "./components/Landing.jsx";
import StatusStrip from "./components/StatusStrip.jsx";
import SourcesPanel from "./components/SourcesPanel.jsx";
import ChatExchange from "./components/ChatExchange.jsx";
import GraphView from "./components/GraphView.jsx";

function App() {
  const [view, setView] = useState("home"); // home | app
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

  if (view === "home") {
    return (
      <div className="min-h-screen bg-canvas">
        <Nav view={view} onNavigate={setView} />
        <Landing onLaunch={() => setView("app")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Nav view={view} onNavigate={setView} tab={tab} onTabChange={setTab} />
      <div className="border-b border-hairline">
        <div className="max-w-4xl mx-auto px-4 pt-3">
          <StatusStrip status={status} error={statusError} />
        </div>
        <div className="max-w-4xl mx-auto">
          <SourcesPanel sources={status?.sources} />
        </div>
      </div>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {tab === "graph" ? (
          <GraphView />
        ) : (
          <>
            {exchanges.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-body-mid gap-2">
                <div className="w-9 h-9 rounded-full border border-hairline flex items-center justify-center text-ink text-sm mb-1">
                  L
                </div>
                <p className="text-sm text-body">Ask something about the brand's visual identity guidelines.</p>
                <p className="text-xs text-body-mid">e.g. "What is the minimum logo clear space?"</p>
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
        <div className="sticky bottom-0 border-t border-hairline bg-canvas/90 backdrop-blur-md">
          <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about brand guidelines…"
              disabled={busy}
              className="flex-1 px-4 py-2.5 rounded-sm bg-canvas-soft border border-hairline text-sm text-ink placeholder-body-mid focus:outline-none focus:border-white/30 transition-colors disabled:opacity-50"
            />
            <button
              onClick={submitQuery}
              disabled={busy || !input.trim()}
              className="px-5 py-2.5 rounded-pill bg-ink text-canvas disabled:bg-canvas-mid disabled:text-body-mid disabled:cursor-not-allowed text-sm font-display transition-colors"
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
