#!/usr/bin/env bash
# Decides whether the unit-test agent may run. This script never receives the API key.
set -euo pipefail
set +x

commit_message="$(git log -1 --format=%s)"
commit_author="$(git log -1 --format=%an)"

decision="$(
  EVENT_NAME="${EVENT_NAME}" \
  HEAD_REPO="${HEAD_REPO}" \
  BASE_REPO="${BASE_REPO}" \
  ACTOR="${ACTOR}" \
  PR_USER="${PR_USER}" \
  IS_DRAFT="${IS_DRAFT}" \
  COMMIT_MESSAGE="${commit_message}" \
  COMMIT_AUTHOR="${commit_author}" \
  HAS_CURSOR_API_KEY="${HAS_CURSOR_API_KEY}" \
  node scripts/agent/decide.mjs
)"

should_run="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).shouldRun ? "true" : "false")' "$decision")"
same_repo="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).sameRepo ? "true" : "false")' "$decision")"
reason="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).reason)' "$decision")"
notice="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).notice ? "true" : "false")' "$decision")"

if [ "$notice" = "true" ]; then
  echo "::notice title=Unit-test agent skipped::${reason}"
fi

git fetch origin "${BASE_REF}" --depth=1
node scripts/agent/changed-files.mjs --base "origin/${BASE_REF}" --head HEAD > changed-files.json

delimiter="UNIT_TEST_AGENT_$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
{
  echo "should_run=${should_run}"
  echo "same_repo=${same_repo}"
  echo "reason<<${delimiter}"
  printf '%s\n' "$reason"
  echo "${delimiter}"
} >> "$GITHUB_OUTPUT"

{
  echo "## Unit-test agent"
  echo
  if [ -n "$reason" ]; then
    printf '%s\n' "$reason"
  else
    echo "The agent will run on this pull request."
  fi
  echo
  echo 'Changed files:'
  echo
  echo '```json'
  cat changed-files.json
  echo '```'
} >> "$GITHUB_STEP_SUMMARY"
