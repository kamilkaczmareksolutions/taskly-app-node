#!/usr/bin/env bash
# Commits the verified test patch. Does not receive the API key.
set -euo pipefail
set +x

if [ -z "${HEAD_REF}" ] || [ "${HEAD_REF}" = "main" ] || [ "${HEAD_REF}" = "master" ]; then
  echo "Refusing to push to ${HEAD_REF:-<empty>}." >&2
  exit 1
fi

if [ ! -s agent.patch ]; then
  echo "No test patch to commit."
  exit 0
fi

git fetch origin "${HEAD_REF}"
git checkout --detach "${HEAD_SHA}"
git apply --index agent.patch
if git diff --cached --quiet; then
  echo "Patch applied with no staged changes."
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit -m "test: cover the pull request behavior [skip unit-test-agent]"
git push origin "HEAD:${HEAD_REF}"
