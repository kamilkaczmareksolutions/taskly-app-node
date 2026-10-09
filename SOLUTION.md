# Unit-test agent

This solution was built AI-first: the author specified and reviewed it, and Cursor agents implemented it.

## TL;DR

A pull request in this repository can ask a pinned Cursor CLI to add unit tests. The model does not push and does not merge. A guard rejects any patch that is not a test file. A human merges. Forks never receive `CURSOR_API_KEY`.

## Permissions

| Job | Token permissions | Secret |
| --- | --- | --- |
| detect | contents: read, actions: write | none. It sees only whether the key is non-empty |
| agent | contents: read, actions: write. Checkout has no git credentials | `CURSOR_API_KEY` on the run step and the scan step |
| guard | contents: read, actions: write | none |
| verify | contents: read, actions: write | none |
| publish | contents: write, pull-requests: write, actions: read | `GITHUB_TOKEN` only, and only on a `pull_request` |

Do not switch the repository's default workflow permission to write. The publish job requests `contents: write` for itself.

## 1. Decisions

The runner is the Cursor CLI, pinned by URL and SHA-256 in `scripts/agent/cursor-cli.version`. The install script checks the hash and stops on a mismatch. The download host is still a supply-chain risk at bump time: a bad URL committed by someone with write access is only caught if the hash in that same commit is the hash of the bad file. Review that file when it changes.

The model is `claude-opus-4-8` because `agent --help` on this pin lists it as the high-effort Claude slug. One explicit model avoids Auto. A reviewer changes the `model=` line to switch. An Opus run on the title-search pull request took about nine minutes. A docs-only run that should have been skipped still spent about two and a half minutes before the empty-diff gate existed.

`pull_request` is used, not `pull_request_target`, so fork code never sees the key. The agent job cannot push. Publish commits only after the guard and verify succeed, and only when `github.event_name` is `pull_request`. A `workflow_dispatch` with an empty branch name skips the commit.

`--force` is on because print mode will not write files without it. It also allows any command that is not denied, so the allow list is not a lock. Deny rules block `git push`, `git commit`, `gh`, `curl`, `wget`, `npm`, and `npx`. They do not stop `node` or `cat` from reading `node_modules`, `.git`, or `.env`. Those Read deny lines do not hold under `--force`. The hard stop for writes is the guard: a clean checkout, then a fail if the patch leaves `*.test.ts`, `*.test.tsx`, or `frontend/src/test/queryWrapper.tsx`, adds `.only`, `.skip`, `it.todo`, a weak matcher such as `toBeDefined`, drops assertions, or touches more than eight test files. Publish runs those checks again before it commits.

The API key is not left in the environment of the CLI process. `run-agent.sh` passes it only as `--api-key` under `env -u CURSOR_API_KEY`. `bounded-test.mjs` deletes the variable again before `npm`. Before the CLI starts, the job removes `scripts/agent`, `.cursor`, and `.github/workflows` and checks those paths out from the base SHA, then unstages that checkout so only the test patch is staged. Files the pull request added under those directories do not stay. The app tree stays from the head. When the base commit has no such path, the job keeps the head copy and prints that. This pull request into `main` is that case: `22be6e3` has none of those paths, so it runs its own tooling. A later pull request, whose base has the files, replaces them. Guard and verify never receive the key. Publish reads `publish-tests.sh` from the base blob and runs the guard scripts from `git archive` of that SHA, after a forced checkout of the head, so the commit checks are not the head copies. A person with write access can still change the workflow file GitHub executes. `git checkout` is denied, and `node` can still run it. This repo has not proved that the CLI never copies `--api-key` back into a tool shell.

`changed-files.mjs` marks only the first eight testable source files as testable. `bounded-test.mjs` runs one test file and refuses a fourth failed run. Direct `npm test` is denied so the agent is steered through that script.

The key is not a job-level variable. Detect also requires the pull request author to have write or admin permission. A same-repository prompt injection is still the threat: there is no shell sandbox, `--force` is on, and `reject-secret` does not decode base64. Notes in the comment are cut to 400 characters and long base64 blobs are removed. That is not a full exfiltration defense.

`GITHUB_TOKEN` can push the bot commit and that push does not start CI. Pull request 2 recorded the follow-up as `action_required`. Verify had already passed in the same run. A GitHub App token would let that commit run `ci.yml`. Keep `[skip unit-test-agent]` so the app token does not pay for a second model call.

Coverage floors: backend 90% statements, lines, and functions, 85% branches. Validators and mappers stay at 100% per file. Frontend 85% is only the files Vite counts. The count excludes `src/design-system/**`, `src/main.tsx`, barrels, type files, `queryKeys.ts`, `queryClient.ts`, and test files. `App.test.tsx` stubs the tasks page. `TodosPage.test.tsx` renders that page, so a broken page still fails its own tests. `format:check` runs in the frontend CI job.

## 2. Reviewer setup

1. Fork the repository. Secrets are not copied.
2. In the fork, open Settings, then Actions, then General, and allow Actions to run.
3. Add a repository secret named `CURSOR_API_KEY` with your own key. The key used for the published demo is revoked after publication. Old runs stay in Actions and on the pull request.
4. The key's account must be allowed to call `claude-opus-4-8`. If the CLI returns "model not found", change `model=` in `scripts/agent/cursor-cli.version`.
5. Open the pull request inside the fork, with both branches in the fork. A pull request from the fork into this repository is skipped on purpose.

Without the secret, detect writes: "Unit-test agent skipped: CURSOR_API_KEY not configured. See SOLUTION.md#prerequisites". The pull request stays green.

## 3. Layout

```text
.cursor/agents/unit-test-agent.md
.cursor/cli.json
.cursor/skills/*/SKILL.md
.github/workflows/ci.yml
.github/workflows/unit-test-agent.yml
scripts/agent/
```

`detect` then `agent` then `guard` then `verify` then `publish`. The comment marker is `<!-- unit-test-agent-report -->`.

## 4. Example run

[Run 37925977823](https://github.com/kamilkaczmareksolutions/taskly-app-node/actions/runs/37925977823) on [pull request 2](https://github.com/kamilkaczmareksolutions/taskly-app-node/pull/2). `demo/search-todos` has the feature and no pull request.

The agent tested the repository, the router, the tasks page, the todos API, and `useTodosQuery`. It skipped `types.ts`. Skills: `analyze-pr-diff`, `backend-unit-tests`, `frontend-unit-tests`, `run-tests-and-coverage`, `report-to-pr`. Changed tests passed twice. Verify passed.

Backend statements 98.44% to 98.5% (+0.06), branches 97.91% to 98.07% (+0.16), functions 96.87%, lines 100%. Frontend statements 99.4% to 99.42% (+0.02), branches 97.81% to 97.93% (+0.12), functions 100%, lines 100%.

## 5. Where the baseline tests came from

Commits `6d79062` and `a655da7` were written in the same Cursor session that added the skills. They were not produced by `unit-test-agent.yml`. The session followed the Vitest and Testing Library style those skills describe. The first time that workflow wrote tests is the bot commit on pull request 2.

## 6. Assumptions

Node 22 is on the runner. Unit tests do not need Postgres. The key can call `claude-opus-4-8`. The author of a same-repository pull request has write or admin. Review text is untrusted.

## 7. Limitations

The model can write a different test each run. A same-repository diff can hide instructions. With no sandbox and with `--force`, that can try to read the key. `reject-secret` matches the raw value, not base64. Notes and reasons lose long base64 blobs, and notes stop at 400 characters. Only a write or admin author starts the agent. Production needs an egress allowlist (`step-security/harden-runner`), a spending-capped key, and the shell sandbox.

The eight-file cap is in `changed-files.mjs` and again on the patch. The three-failure cap is in `bounded-test.mjs`. A command that is not denied can ignore it. `node` and `cat` can read paths the Read deny list names. `GITHUB_TOKEN` does not retrigger workflows. The factory branch after headers are sent, and the lifespan `process.exit` timer, stay untested on purpose.

## 8. Production extensions

Use a GitHub App token so the bot commit runs CI. Keep the skip trailer so it does not run the model again. Add mutation testing, a label trigger, a rate limit, and an environment protection rule on the secret.

GitHub Agentic Workflows (`gh-aw`) compile markdown into Actions and let the agent speak only through safe outputs. An MCP server would expose "read file" and "run test" and refuse the rest. This repo uses the Cursor CLI because `.cursor/agents`, the skills, and `cli.json` are the files a local `agent` run already reads.
