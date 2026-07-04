"""
Wrapper around the Claude Code CLI's headless print-mode, used instead of a
paid Anthropic API key -- authenticates via the existing Claude Code/Claude.ai
session already logged in on this machine.

ROOT-CAUSE NOTE (do not re-break this): on Windows, `claude` resolves to a
.cmd shim. Its argument-forwarding gets reprocessed by cmd.exe, which means
ANY argv value containing a cmd.exe metacharacter (< > | & ^) -- anywhere in
the string, not just at the start -- can silently corrupt or truncate the
whole command line. This has already caused two separate silent failures in
this project (a prompt starting with "--" read as an unknown option; a JSON
schema `description` field containing "->" whose ">" was read as output
redirection, producing an empty response with no error). The fixes:
  - `prompt` is piped via stdin (never an argv value) -- bypasses this class
    of bug entirely for arbitrary/long content.
  - `system_prompt` is written to a temp file and passed via
    `--system-prompt-file` (a real flag, undocumented in `claude -p --help`
    but confirmed working) -- same reasoning, zero risk regardless of content.
  - `json_schema` has NO file-based flag (`--json-schema-file` does not
    exist, confirmed by testing) and must stay a CLI argument. `_assert_argv_safe`
    below fails loudly and immediately if it contains an unsafe character,
    instead of the silent empty-output failure this bug class produces by
    default -- keep schema `description` fields free of <>|&^ characters.
"""
import json
import os
import shutil
import subprocess
import tempfile

# On Windows, the `claude` CLI is a .cmd shim; subprocess.run needs the
# resolved path (with extension) since it doesn't go through a shell here.
CLAUDE_BIN = shutil.which("claude") or "claude"

_UNSAFE_ARGV_CHARS = set("<>|&^")


class ClaudeCallError(RuntimeError):
    pass


def _assert_argv_safe(value: str, label: str) -> None:
    bad = _UNSAFE_ARGV_CHARS & set(value)
    if bad:
        raise ClaudeCallError(
            f"{label} contains cmd.exe metacharacter(s) {sorted(bad)} -- "
            f"passing this as a CLI argument to the `claude` .cmd shim on "
            f"Windows will silently corrupt the command line (this exact "
            f"class of bug has already happened twice in this project). "
            f"Remove the character(s) from {label} instead."
        )


def call_claude(
    prompt: str,
    system_prompt: str,
    json_schema: dict | None = None,
    model: str = "sonnet",
    timeout: int = 60,
    tools: str = "",
) -> str | dict:
    """`tools` defaults to "" (no tools) for every RAG generation call
    (draft/critique/refine/grounding) -- deliberate, keeps those calls
    deterministic and unable to reach outside the sanitized DATA block passed
    in the prompt. Only the web-ingestion path (web_ingest.py) should ever
    pass a non-empty value (e.g. "WebSearch,WebFetch")."""
    fd, sysprompt_path = tempfile.mkstemp(suffix=".txt", prefix="claude_sysprompt_")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(system_prompt)

        cmd = [
            CLAUDE_BIN, "-p",
            "--output-format", "json",
            "--no-session-persistence",
            "--tools", tools,
            "--system-prompt-file", sysprompt_path,
            "--model", model,
        ]
        if json_schema is not None:
            schema_str = json.dumps(json_schema)
            _assert_argv_safe(schema_str, "json_schema")
            cmd += ["--json-schema", schema_str]

        # encoding must be pinned to utf-8 explicitly: subprocess's `text=True`
        # otherwise decodes with the platform's default locale encoding, which
        # on Windows is typically cp1252/the console codepage, not UTF-8 --
        # that mismatch silently corrupts any non-ASCII character (em-dashes,
        # curly quotes, accented names) the CLI emits in its UTF-8 JSON output.
        proc = subprocess.run(
            cmd, input=prompt, capture_output=True, text=True,
            encoding="utf-8", timeout=timeout,
        )
    finally:
        os.remove(sysprompt_path)

    if not proc.stdout.strip():
        raise ClaudeCallError(f"Empty response from claude CLI. stderr: {proc.stderr}")

    data = json.loads(proc.stdout.strip().splitlines()[-1])

    if data.get("is_error"):
        raise ClaudeCallError(f"claude CLI reported error: {data}")

    if json_schema is not None:
        return data["structured_output"]
    return data["result"]
