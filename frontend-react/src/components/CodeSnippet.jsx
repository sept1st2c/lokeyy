import { useState } from "react";

const SNIPPETS = {
  Python: `import requests

res = requests.post(
    "http://127.0.0.1:8000/api/query",
    json={"query": "Write a LinkedIn post about our new display"},
)
data = res.json()

print(data["final_answer"])       # grounded copy, or a flagged failure
print(data["passes"])             # False if a rule was broken or
                                   # a citation didn't check out
print(data["final_confidence"])   # trust-weighted 0-100`,
  cURL: `curl -X POST http://127.0.0.1:8000/api/query \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Write a LinkedIn post about our new display"}'`,
};

function highlight(code, lang) {
  return code.split("\n").map((line, i) => {
    const parts = [];
    const pattern =
      lang === "Python"
        ? /(""".*?"""|#.*$|"[^"]*"|\b(?:import|from|as|print)\b)/g
        : /(-H|-d|-X|--\S+)/g;
    let last = 0;
    let m;
    while ((m = pattern.exec(line))) {
      if (m.index > last) parts.push(<span key={last}>{line.slice(last, m.index)}</span>);
      const isComment = m[0].startsWith("#");
      const isString = m[0].startsWith('"');
      const isKeyword = /^(import|from|as|print|-H|-d|-X|--\S+)$/.test(m[0]);
      parts.push(
        <span
          key={m.index}
          style={{
            color: isComment ? "#7d8187" : isString ? "#7ee787" : isKeyword ? "#c4b5fd" : undefined,
          }}
        >
          {m[0]}
        </span>
      );
      last = m.index + m[0].length;
    }
    parts.push(<span key={last}>{line.slice(last)}</span>);
    return <div key={i}>{parts}</div>;
  });
}

export default function CodeSnippet() {
  const [lang, setLang] = useState("Python");
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText(SNIPPETS[lang]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-sm border border-hairline bg-canvas-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </span>
        <div className="flex items-center gap-1">
          {Object.keys(SNIPPETS).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2.5 py-1 rounded-pill text-[11px] font-mono-brand transition-colors ${
                lang === l ? "bg-ink text-canvas" : "text-body-mid hover:text-ink"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="text-[11px] font-mono-brand text-body-mid hover:text-ink transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-4 font-mono-brand text-[12.5px] leading-[1.8] text-body overflow-x-auto">
        {highlight(SNIPPETS[lang], lang)}
      </pre>
    </div>
  );
}
