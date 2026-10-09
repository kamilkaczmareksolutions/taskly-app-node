#!/usr/bin/env bash
# Decides whether the unit-test agent may run. This script never receives the API key.
set -euo pipefail
set +x

# pull_request checkouts are the merge commit. The skip trailer lives on the head commit.
commit_message="$(git log -1 --format=%s "${HEAD_SHA}")"
commit_author="$(git log -1 --format=%an "${HEAD_SHA}")"

author_user="${PR_USER}"
if [ -z "$author_user" ]; then
  author_user="${ACTOR}"
fi
author_permission="none"
if [ "$author_user" = "dependabot[bot]" ]; then
  author_permission="none"
elif [ -n "$author_user" ]; then
  encoded_user="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$author_user")"
  author_permission="$(gh api "repos/${BASE_REPO}/collaborators/${encoded_user}/permission" --jq .permission 2>/dev/null || echo none)"
fi

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
  AUTHOR_PERMISSION="${author_permission}" \
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

if [ "$should_run" = "true" ]; then
  gated="$(node --input-type=module -e "import { readFileSync } from 'node:fs'; import { gateShouldRun } from './scripts/agent/decide.mjs'; const report = JSON.parse(readFileSync('changed-files.json', 'utf8')); process.stdout.write(JSON.stringify(gateShouldRun({ shouldRun: true, sameRepo: true, reason: '', notice: false }, report)));")"
  should_run="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).shouldRun ? "true" : "false")' "$gated")"
  gated_reason="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).reason)' "$gated")"
  if [ -n "$gated_reason" ]; then
    reason="$gated_reason"
  fi
fi

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
