---
name: report-to-pr
description: Write agent-report.json from the plan, decisions, skills, and commands that actually ran. Use at the end of the unit-test agent run.
---

# Report for the pull request

You write the report file. You do not post it and you do not merge. The publish job renders the comment from this file, the workflow's own test runs, and the cost lines in `scripts/agent/cursor-cli.version`. A human merges.

## Steps

1. Open `agent-report.json`. Keep the plan you wrote before editing. Update `decisions` so each planned path appears once.
2. `tested` requires a matching `evidence` entry whose `exitCode` is `0` and whose command names the test file. Otherwise use `skipped` and say the test was not run.
3. `skipped` needs a reason: documentation, config, story, types only, styling only, no behavior change, or the new test failed three times.
4. Set `skillsUsed` to the skill folder names you followed. Set `testFilesWritten` to files you created or edited.
5. Put suspected bugs in `suspectedBugs`. Leave the array empty when there are none.
6. `notes` is a few sentences. Do not paste a diff, a log, or an environment variable.
7. Check the JSON parses. A missing file is a failed run.

## Example decision

```json
{ "path": "frontend/src/lib/http.ts", "decision": "skipped", "reason": "The diff is a comment. No request behavior changed.", "testFiles": [] }
```

The published comment shows these decisions and the coverage delta from `scripts/agent/render-report.mjs`. The pass counts in that comment come from the workflow rerun, not from this file's prose.
