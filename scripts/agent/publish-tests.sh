#!/usr/bin/env bash
# Commits the verified test patch. Does not receive the API key.
# The workflow runs a copy of this file from outside the worktree, because the
# checkout below replaces every file in the pull request head.
set -euo pipefail
set +x

if [ -z "${HEAD_REF:-}" ]; then
  echo "No pull request branch. Skipping the commit."
  exit 0
fi
if [ "${HEAD_REF}" = "main" ] || [ "${HEAD_REF}" = "master" ]; then
  echo "Refusing to push to ${HEAD_REF}." >&2
  exit 1
fi

if [ ! -s agent.patch ]; then
  echo "No test patch to commit."
  exit 0
fi

git fetch origin "${HEAD_REF}"
git checkout -f --detach "${HEAD_SHA}"

guard_dir="scripts/agent"
if [ -n "${BASE_SHA:-}" ]; then
  if ! git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
    git fetch origin "${BASE_SHA}"
  fi
  if git cat-file -e "${BASE_SHA}:scripts/agent" 2>/dev/null; then
    tools="$(mktemp -d)"
    git archive "${BASE_SHA}" scripts/agent | tar -x -C "${tools}"
    guard_dir="${tools}/scripts/agent"
  else
    echo "Base commit has no scripts/agent. Using the head copies for the commit checks."
  fi
fi

git apply --index agent.patch
node "${guard_dir}/guard-test-only-changes.mjs"
node "${guard_dir}/check-no-focus-skip.mjs" agent.patch
node "${guard_dir}/check-budget.mjs"
if git diff --cached --quiet; then
  echo "Patch applied with no staged changes."
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit -m "test: cover the pull request behavior [skip unit-test-agent]"
git push origin "HEAD:${HEAD_REF}"
