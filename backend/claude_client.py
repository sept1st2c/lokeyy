"""
Wrapper around the Claude Code CLI's headless print-mode, used instead of a
paid Anthropic API key -- authenticates via the existing Claude Code/Claude.ai
session already logged in on this machine.
"""
import json
import shutil
import subprocess

# On Windows, the `claude` CLI is a .cmd shim; subprocess.run needs the
# resolved path (with extension) since it doesn't go through a shell here.
CLAUDE_BIN = shutil.which("claude") or "claude"


class ClaudeCallError(RuntimeError):
    pass


def call_claude(
    prompt: str,
    system_prompt: str,
    json_schema: dict | None = None,
    model: str = "sonnet",
    timeout: int = 60,
) -> str | dict:
    # Prompt is piped via stdin rather than passed as a CLI argument: the
    # `claude` command is a Windows .cmd shim, and its argument-forwarding
    # re-tokenizes on whitespace, which mangles/breaks any long or
    # punctuation-heavy prompt passed positionally (e.g. one starting with
    # "--" gets misread as an unknown option). Stdin bypasses that entirely.
    cmd = [
        CLAUDE_BIN, "-p",
        "--output-format", "json",
        "--no-session-persistence",
        "--tools", "",
        "--system-prompt", system_prompt,
        "--model", model,
    ]
    if json_schema is not None:
        cmd += ["--json-schema", json.dumps(json_schema)]

    proc = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=timeout)

    if not proc.stdout.strip():
        raise ClaudeCallError(f"Empty response from claude CLI. stderr: {proc.stderr}")

    data = json.loads(proc.stdout.strip().splitlines()[-1])

    if data.get("is_error"):
        raise ClaudeCallError(f"claude CLI reported error: {data}")

    if json_schema is not None:
        return data["structured_output"]
    return data["result"]
