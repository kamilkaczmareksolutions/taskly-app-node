#!/usr/bin/env bash
# Runs the pinned Cursor CLI. The API key is already in the environment.
# Do not enable xtrace and do not print the environment.
set -euo pipefail
set +x

if [ -z "${CURSOR_API_KEY:-}" ]; then
  echo "CURSOR_API_KEY is empty" >&2
  exit 1
fi

prompt="$(cat scripts/agent/prompt.md)"
read_pin() {
  node -e 'const {readFileSync}=require("node:fs"); const key=process.argv[1]; const text=readFileSync("scripts/agent/cursor-cli.version","utf8"); const line=text.split(/\n/).find((entry)=>entry.startsWith(key+"=")); if(!line) process.exit(1); process.stdout.write(line.slice(key.length+1));' "$1"
}
model="$(read_pin model)"
timeout_seconds="$(read_pin timeout-seconds)"

# --force applies edits in print mode. Deny rules in .cursor/cli.json still win.
# Sandbox stays off so the agent can execute vitest. The deny list blocks push, commit, install, and downloads.
timeout --signal=TERM "${timeout_seconds}" "${AGENT_BIN}" \
  -p \
  --force \
  --trust \
  --workspace "${GITHUB_WORKSPACE}" \
  --model "${model}" \
  --output-format json \
  "${prompt}" > agent-output.json

if [ -d backend/tests ]; then
  git add -N -- backend/tests >/dev/null 2>&1 || true
fi
if [ -d frontend/src ]; then
  git add -N -- frontend/src >/dev/null 2>&1 || true
fi
git diff -- backend/tests frontend/src > agent.patch

if [ ! -f agent-report.json ]; then
  printf '%s\n' '{"plan":[],"decisions":[],"skillsUsed":[],"testFilesWritten":[],"suspectedBugs":[],"evidence":[],"notes":"The agent exited without writing agent-report.json."}' > agent-report.json
fi
