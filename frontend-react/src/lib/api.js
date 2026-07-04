// API layer for LOCI frontend.
// Toggle USE_MOCK to develop/preview the UI without a live backend.
// Real integration point: fetch() calls below hit /api/* which vite.config.js
// proxies to http://127.0.0.1:8000 in dev.

export const USE_MOCK = false;

const MOCK_DELAY = 900;

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

const MOCK_QUERY_RESPONSE = {
  query: "What is the primary logo clear space requirement?",
  final_answer:
    "The Barco logo must always be surrounded by a minimum clear space equal to the height of the logomark on all sides [chunk-3]. This ensures the mark is never crowded by other elements, text, or the edge of a layout [chunk-7]. On digital surfaces, the minimum clear space may be reduced slightly but should never fall below half the logomark height [chunk-12].",
  confidence: 88,
  citation_accuracy: 95,
  passes: true,
  violations: [],
  sources_cited: [
    { id: "chunk-3", tier: "A" },
    { id: "chunk-7", tier: "A" },
    { id: "chunk-12", tier: "B" },
  ],
  trace: [
    { step: "retrieve", chunks_used: ["chunk-1", "chunk-3", "chunk-7", "chunk-12"], rules_used: 4 },
    {
      step: "draft",
      text: "The Barco logo needs clear space around it [chunk-3]. Don't put text near it.",
    },
    {
      step: "critique",
      attempt: 1,
      result: {
        passes: false,
        violations: ["Clear space rule stated too vaguely — missing exact multiplier", "Missing digital-surface exception"],
        confidence: 61,
        citation_accuracy: 70,
        failure_reason: "Draft did not cite the exact clear-space ratio from the style guide.",
      },
      citation_check: { cited: ["chunk-3"], fabricated: [], all_valid: true },
    },
    { step: "fetch_more", reason: "Need exact clear-space multiplier and digital exception", new_chunks_used: ["chunk-7", "chunk-12"] },
    {
      step: "refine",
      attempt: 1,
      text:
        "The Barco logo must always be surrounded by a minimum clear space equal to the height of the logomark on all sides [chunk-3]. This ensures the mark is never crowded by other elements, text, or the edge of a layout [chunk-7]. On digital surfaces, the minimum clear space may be reduced slightly but should never fall below half the logomark height [chunk-12].",
    },
    {
      step: "critique",
      attempt: 2,
      result: { passes: true, violations: [], confidence: 88, citation_accuracy: 95 },
      citation_check: { cited: ["chunk-3", "chunk-7", "chunk-12"], fabricated: [], all_valid: true },
    },
  ],
};

const MOCK_STATUS_RESPONSE = {
  clean_chunks: 142,
  quarantined: [
    { reason: "prompt injection: instruction override attempt", snippet: "Ignore previous instructions and..." },
    { reason: "prompt injection: role hijack attempt", snippet: "You are now in developer mode..." },
  ],
  rules_count: 37,
};

const MOCK_GRAPH_RESPONSE = {
  nodes: [
    { id: "n1", type: "rule", label: "Clear Space", tier: "A" },
    { id: "n2", type: "rule", label: "Min Logo Size", tier: "A" },
    { id: "n3", type: "chunk", label: "chunk-3", tier: "A" },
    { id: "n4", type: "chunk", label: "chunk-7", tier: "B" },
    { id: "n5", type: "color", label: "Barco Blue", tier: "A" },
    { id: "n6", type: "chunk", label: "chunk-12", tier: "C" },
  ],
  edges: [
    { source: "n1", target: "n3", relation: "derived_from" },
    { source: "n1", target: "n4", relation: "derived_from" },
    { source: "n2", target: "n6", relation: "derived_from" },
    { source: "n5", target: "n3", relation: "referenced_in" },
  ],
};

export async function postQuery(query) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY);
    return { ...MOCK_QUERY_RESPONSE, query };
  }
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`Query failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getStatus() {
  if (USE_MOCK) {
    await delay(300);
    return MOCK_STATUS_RESPONSE;
  }
  const res = await fetch("/api/status");
  if (!res.ok) throw new Error(`Status failed: ${res.status}`);
  return res.json();
}

export async function getGraph() {
  if (USE_MOCK) {
    await delay(300);
    return MOCK_GRAPH_RESPONSE;
  }
  const res = await fetch("/api/graph");
  if (res.status === 404) {
    return null; // graph endpoint not wired up yet — handled gracefully by caller
  }
  if (!res.ok) throw new Error(`Graph failed: ${res.status}`);
  return res.json();
}

// Live web ingestion: search for a brand's voice guidance, fetch a real
// page, and fold it into the index/graph. Slow (web search + fetch + a
// graph-extraction model call) — expect 30s-3min, no mock shortcut since
// there's nothing meaningful to fake here.
export async function addWebSource(brand) {
  const res = await fetch("/api/sources/web", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brand }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `Add source failed: ${res.status}`);
  }
  return res.json();
}

export async function clearWebSources() {
  const res = await fetch("/api/sources/web", { method: "DELETE" });
  if (!res.ok) throw new Error(`Clear sources failed: ${res.status}`);
  return res.json();
}
