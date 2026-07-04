"""
Live brand ingestion from the web: search for a brand's voice/style
guidance, fetch a real page, and save clean text for the normal ingestion
pipeline to pick up -- the "search for sites and get their knowledge graph"
feature.

Uses the Claude Code CLI's own WebSearch/WebFetch tools (the only call site
in this project where tools are ever enabled -- every RAG generation call in
critique.py/graph.py stays tool-free on purpose, see claude_client.py).
Deliberately NOT a hand-rolled scraper: no new API key, no BeautifulSoup
brittleness against JS-rendered sites, and Claude can actually judge which
fetched page is real brand guidance vs. an unrelated result.
"""
import os
import re

from claude_client import call_claude, ClaudeCallError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_SOURCES_DIR = os.path.join(BASE_DIR, "data", "web_sources")

SEARCH_SYSTEM_PROMPT = (
    "You are a research assistant with real web search and web fetch tools. "
    "You must actually use them, not answer from memory. Find real, current "
    "brand voice / tone-of-voice / messaging guidance for the requested "
    "brand, from an official or reputable source. Fetch the most relevant "
    "real page. If no official public brand-voice document exists, say so "
    "explicitly and summarize the best reputable secondary analysis you "
    "found instead -- never invent rules that weren't actually on a page "
    "you fetched."
)


class WebIngestError(RuntimeError):
    pass


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "brand"


def search_brand_voice(brand_query: str) -> dict:
    """Returns {"filename", "fetched_url", "text"}. Raises WebIngestError if
    the search/fetch genuinely turns up nothing usable."""
    prompt = (
        f"Search for {brand_query}'s brand voice, tone-of-voice, or brand "
        "messaging guidelines. Fetch the most relevant real page you find.\n\n"
        "Return your answer as plain text in this exact structure (no "
        "markdown headers, no code fences):\n"
        "FETCHED_URL: <the real URL you fetched>\n"
        "---\n"
        "<clean paragraphs of the actual voice/tone/messaging rules you "
        "found on that page -- preferred/forbidden words, tone traits, "
        "taboo topics, examples -- written as plain prose paragraphs "
        "separated by blank lines, the way a style guide would be written. "
        "If nothing genuine was found, write exactly: NOT_FOUND>"
    )
    try:
        result = call_claude(
            prompt=prompt,
            system_prompt=SEARCH_SYSTEM_PROMPT,
            tools="WebSearch,WebFetch",
            timeout=120,
        )
    except ClaudeCallError as e:
        raise WebIngestError(f"Web search/fetch failed: {e}") from e

    if "NOT_FOUND" in result.upper() and "---" not in result:
        raise WebIngestError(
            f"No usable brand voice guidance found for '{brand_query}'."
        )

    url_match = re.search(r"FETCHED_URL:\s*(\S+)", result)
    fetched_url = url_match.group(1) if url_match else "unknown"
    body = result.split("---", 1)[1].strip() if "---" in result else result.strip()

    if not body or "NOT_FOUND" in body.upper():
        raise WebIngestError(
            f"No usable brand voice guidance found for '{brand_query}'."
        )

    return {
        "filename": f"web-{_slug(brand_query)}.txt",
        "fetched_url": fetched_url,
        "text": body,
    }


def save_web_source(brand_query: str) -> dict:
    result = search_brand_voice(brand_query)
    os.makedirs(WEB_SOURCES_DIR, exist_ok=True)
    path = os.path.join(WEB_SOURCES_DIR, result["filename"])
    header = f"[web-sourced: {result['fetched_url']}]\n\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(header + result["text"])
    return result


def clear_web_sources() -> int:
    if not os.path.isdir(WEB_SOURCES_DIR):
        return 0
    removed = 0
    for name in os.listdir(WEB_SOURCES_DIR):
        if name.endswith(".txt"):
            os.remove(os.path.join(WEB_SOURCES_DIR, name))
            removed += 1
    return removed
