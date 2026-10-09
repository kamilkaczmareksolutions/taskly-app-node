---
name: fix-failing-test
description: Retry a failing new test at most three times without weakening the assertion or editing production code. Use when a test you just added fails.
---

# Fix a failing new test

Use this only for a test you added in this run. Stop at `max-fix-attempts` in `scripts/agent/cursor-cli.version` (3). The tree you leave behind must pass. Delete the new test rather than leave it red.

## Steps

1. Read the failure. Name the expected value and the actual value in one sentence.
2. Fix the test setup, the input, or the assertion so it matches the behavior the source already implements. Run the same test file again. Record the command in `evidence`.
3. Attempt 2 and attempt 3 are the same loop. Do not change an expected status, message, or payload just to match a surprise result.
4. Do not edit production code, config, or an older assertion that was already passing.
5. After the third failing run, delete the new test. Add a `suspectedBugs` entry with the file, the input, and the actual result. Set the decision to `skipped` and say the new test failed three times and was removed.
6. Do not leave `it.skip`, `it.only`, or `it.todo` behind.

## Example

A new health test expected `503` and the app returned `500` with `{ detail: 'Internal Server Error' }`. The source is doing what it says. Change the assertion to `500` and that body, then rerun. If the source returned `200` while the database spy rejected, that is a suspected bug: delete the new test and report it. Do not edit `health.ts`.
