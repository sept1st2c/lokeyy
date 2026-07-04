import { useEffect, useRef, useState } from "react";
import { getGraph } from "../lib/api.js";

const TYPE_COLORS = {
  rule: "#c4b5fd",
  chunk: "#a0c3ec",
  color: "#ff7a17",
  preferred_term: "#7ee787",
  default: "#7d8187",
};

const TIER_OPACITY = { A: 1, B: 0.75, C: 0.5 };

export default function GraphView() {
  const canvasRef = useRef(null);
  const [graph, setGraph] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | empty | error
  const [standaloneInfo, setStandaloneInfo] = useState(null); // { connected, total }

  useEffect(() => {
    let cancelled = false;
    getGraph()
      .then((data) => {
        if (cancelled) return;
        if (!data || !data.nodes || data.nodes.length === 0) {
          setStatus("empty");
          return;
        }
        setGraph(data);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "ready" || !graph) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const nodes = graph.nodes.map((n, i) => {
      const angle = (i / graph.nodes.length) * Math.PI * 2;
      const radius = 150 + Math.random() * 120; // jitter so symmetric layouts don't clump at the boundary
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });
    const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const edges = graph.edges
      .map((e) => ({ ...e, s: nodeById[e.source], t: nodeById[e.target] }))
      .filter((e) => e.s && e.t);

    // Most rule nodes have no stated relationship to another rule (only
    // "preferred_over" pairs get an edge) -- drawing a full text label on
    // all ~50 of them is what caused the illegible pile-up. Only the
    // connected ones (the actual "relationships" a graph is for) get
    // labels; the rest render as small dim dots so the count is still
    // visible without the text collision.
    const degree = {};
    for (const e of edges) {
      degree[e.s.id] = (degree[e.s.id] || 0) + 1;
      degree[e.t.id] = (degree[e.t.id] || 0) + 1;
    }
    const connectedCount = nodes.filter((n) => degree[n.id]).length;
    setStandaloneInfo({ connected: connectedCount, total: nodes.length });

    let raf;
    let running = true;

    function tick() {
      if (!running) return;
      // repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist2 = dx * dx + dy * dy || 0.01;
          const force = 9000 / dist2;
          const dist = Math.sqrt(dist2);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      // attraction along edges
      for (const e of edges) {
        const dx = e.t.x - e.s.x;
        const dy = e.t.y - e.s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (dist - 90) * 0.01;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        e.s.vx += fx;
        e.s.vy += fy;
        e.t.vx -= fx;
        e.t.vy -= fy;
      }
      // center pull + integrate
      for (const n of nodes) {
        n.vx += (width / 2 - n.x) * 0.001;
        n.vy += (height / 2 - n.y) * 0.001;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(20, Math.min(width - 20, n.x));
        n.y = Math.max(20, Math.min(height - 20, n.y));
      }

      ctx.clearRect(0, 0, width, height);

      // edges
      ctx.lineWidth = 1;
      for (const e of edges) {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
        ctx.beginPath();
        ctx.moveTo(e.s.x, e.s.y);
        ctx.lineTo(e.t.x, e.t.y);
        ctx.stroke();
      }

      // nodes
      for (const n of nodes) {
        const connected = !!degree[n.id];
        const color = TYPE_COLORS[n.type] || TYPE_COLORS.default;
        const baseOpacity = n.tier ? TIER_OPACITY[n.tier] ?? 1 : 1;
        const opacity = connected ? baseOpacity : baseOpacity * 0.5;
        const radius = connected ? 9 : 4;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (n.tier && connected) {
          ctx.lineWidth = n.tier === "A" ? 2.5 : n.tier === "B" ? 1.5 : 1;
          ctx.strokeStyle = "rgba(255,255,255,0.8)";
          ctx.stroke();
        }
        if (connected) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#cbd5e1";
          ctx.font = "11px system-ui, sans-serif";
          const rawLabel = n.label ?? n.id;
          const label = rawLabel.length > 22 ? rawLabel.slice(0, 22) + "…" : rawLabel;
          ctx.fillText(label, n.x + 12, n.y + 4);
        }
      }

      raf = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [status, graph]);

  if (status === "loading") {
    return <div className="text-body-mid text-sm p-8 text-center">Loading knowledge graph…</div>;
  }
  if (status === "error") {
    return (
      <div className="text-[#ff9a8a] text-sm p-8 text-center border border-hairline rounded-sm bg-canvas-card">
        Could not reach /api/graph.
      </div>
    );
  }
  if (status === "empty") {
    return (
      <div className="text-body-mid text-sm p-8 text-center border border-hairline rounded-sm bg-canvas-card">
        Knowledge graph endpoint isn't available yet. Once <code className="text-body">/api/graph</code> is wired up
        on the backend, it will render here automatically.
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-hairline bg-canvas-card p-3">
      <canvas ref={canvasRef} width={1100} height={680} className="w-full h-auto" />
      <div className="flex flex-wrap gap-4 mt-2 px-2 text-xs text-body-mid">
        {Object.entries(TYPE_COLORS)
          .filter(([k]) => k !== "default")
          .map(([type, color]) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} /> {type}
            </span>
          ))}
        <span className="text-body-mid/60">| border thickness = tier confidence</span>
        {standaloneInfo && (
          <span className="text-body-mid/60">
            | showing labels for {standaloneInfo.connected} of {standaloneInfo.total} rules
            (small dim dots = rules with no stated relationship to another rule)
          </span>
        )}
      </div>
    </div>
  );
}
