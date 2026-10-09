# Unit-test agent

This solution was built AI-first: the author specified and reviewed it, and Cursor agents implemented it.

## 1. Main technical decisions

The agent is the Cursor CLI (`agent`), pinned by URL and SHA-256 in `scripts/agent/cursor-cli.version`. The workflow does not pipe `https://cursor.com/install` into a shell. The model slug is `claude-opus-4-8`, the explicit model named by that CLI build.

The workflow uses `pull_request`, not `pull_request_target`. `pull_request` runs the workflow from the pull request and does not give fork commits the repository secrets.

`.cursor/cli.json` is the project permissions file. This CLI build rejects `version` and `editor` in that file. Those keys belong in the global config. The agent job checks out the head commit with `persist-credentials: false` and `contents: read`. It cannot push. The publish job is the only job with `contents: write` and `pull-requests: write`. It commits only after the guard and the verify job pass.

`CURSOR_API_KEY` is set on two steps in the agent job: the CLI run, and the scan that follows it. It is not a job-level variable. The detect job receives only a boolean, `secrets.CURSOR_API_KEY != ''`. Fork pull requests and Dependabot are skipped before those steps, so they never receive the key. The scan reads the patch, the report, and the raw CLI log. A match fails the job. The log line names the file and does not print the key. The raw log is deleted and is not uploaded. Those steps do not use `set -x`. GitHub still masks a registered secret if it appears in a log.

Print mode does not write files unless `--force` is set. `--force` allows commands that are not denied, so the allow list is not a lock. Deny rules still block `git push`, `git commit`, `gh`, `curl`, `wget`, `npm install`, `rm`, environment files, and writes to workflows, skills, and lockfiles. They do not name every source file. The guard on a clean checkout is the hard stop. It rejects any non-test path, `.only`, `.skip`, `it.todo`, and a net deletion of assertions. Publish commits only after that job succeeds.

Verify runs typecheck and coverage on a clean checkout plus the patch. That run, not the model's own sentence, is the published proof. A `GITHUB_TOKEN` commit does not start a new workflow run. Verify has already finished in this run, which is why the bot commit includes `[skip unit-test-agent]` as a second stop.

Actions are pinned to full commit SHAs. `actions: write` is on the jobs that upload artifacts. `contents: read` alone cannot upload them.

The agent follows six working rules. It writes a plan before it edits. It changes one source file at a time. It runs the test before it marks the file tested. The report quotes those commands, and the workflow runs the tests again. It skips a file only with a reason. It retries a failing new test at most three times, and it does not weaken the assertion or edit production code. It does not finish while a test it kept is failing. A red guard or verify job does not commit. The bot proposes the patch. A human merges.

Cost is bounded in `scripts/agent/cursor-cli.version`: model `claude-opus-4-8`, a 720 second timeout, 8 source files, and 3 fix attempts. This CLI build has no max-turn flag and no dollar cap. The report prints those numbers. `--force` still honors deny rules, so reads of `node_modules`, `.git`, coverage, and `.env` stay denied. The prompt tells the agent to read only the changed source, its test, and the skill it is using.

CI runs `npm run format:check` in the frontend job. `backend/src/main.ts` stays in the coverage set. The factory branch that runs after headers are sent, and the lifespan timeout that calls `process.exit`, stay untested on purpose. Hitting them would exit the process or need a response that has already started.

## 2. How to run the workflow

### Prerequisites

Add a repository secret named `CURSOR_API_KEY`. In the repository settings, give Actions permission to read and write contents so the publish job can push to the pull request branch. Pull request comments need the `pull-requests: write` permission already set on that job.

The workflow runs on `pull_request` (`opened`, `synchronize`, `reopened`, `ready_for_review`) and on `workflow_dispatch`. Draft pull requests are skipped. A head commit whose message contains `[skip unit-test-agent]`, or whose author is `github-actions[bot]`, is skipped.

If the secret is missing, the detect job writes a notice and a job summary: "Unit-test agent skipped: CURSOR_API_KEY not configured. See SOLUTION.md#prerequisites". The pull request stays green.

### Plugging in your own CURSOR_API_KEY

To run the workflow on a fork or a copy, create your own Cursor API key and save it as the Actions secret `CURSOR_API_KEY` in that repository. A fork does not receive this repository's secrets. The key used to publish this repository is revoked after publication. Runs that already finished stay visible in the Actions tab and on the pull request.

## 3. Where the agent and skills are defined

```text
.cursor/agents/unit-test-agent.md
.cursor/cli.json
.cursor/skills/analyze-pr-diff/SKILL.md
.cursor/skills/backend-unit-tests/SKILL.md
.cursor/skills/frontend-unit-tests/SKILL.md
.cursor/skills/run-tests-and-coverage/SKILL.md
.cursor/skills/fix-failing-test/SKILL.md
.cursor/skills/report-to-pr/SKILL.md
.github/workflows/ci.yml
.github/workflows/unit-test-agent.yml
scripts/agent/
```

The CLI is told to follow `.cursor/agents/unit-test-agent.md` and the skills. `changed-files.json` is passed as data. The agent writes `agent-report.json` and test files. The publish job turns that file, plus the workflow's own test and coverage output, into one sticky comment marked `<!-- unit-test-agent-report -->`.

```mermaid
flowchart LR
  detect[detect]
  agent[agent]
  guard[guard]
  verify[verify]
  publish[publish]
  detect --> agent --> guard --> verify --> publish
```

`detect` has no API key. `agent` installs the pinned CLI and runs it. `guard` applies the patch and checks the diff, then runs the new tests twice. `verify` repeats typecheck and coverage on a clean tree. `publish` commits and comments only for a same-repository pull request.

## 4. Example run

Run: [Unit-test agent on the title-search pull request](https://github.com/kamilkaczmareksolutions/taskly-app-node/actions/runs/37925977823). Pull request: [feat: search todos by title](https://github.com/kamilkaczmareksolutions/taskly-app-node/pull/2). `demo/search-todos` is the same feature with no pull request and no tests.

The agent planned six files. It tested the repository, the router, the tasks page, the todos API, and `useTodosQuery`. It skipped `types.ts` because the change is a type. Skills: `analyze-pr-diff`, `backend-unit-tests`, `frontend-unit-tests`, `run-tests-and-coverage`, `report-to-pr`.

The agent recorded green commands, including 13 passing backend tests for the repository and the router. The workflow then ran the changed tests twice (not flaky) and verify passed. Coverage against that run's base:

- Backend statements 98.44% to 98.5% (+0.06). Branches 97.91% to 98.07% (+0.16). Functions 96.87% to 96.87%. Lines 100% to 100%.
- Frontend statements 99.4% to 99.42% (+0.02). Branches 97.81% to 97.93% (+0.12). Functions 100% to 100%. Lines 100% to 100%.

The bot pushed `test: cover the pull request behavior [skip unit-test-agent]`. That commit does not start a new workflow run. GitHub records the follow-up as `action_required`. Verify had already passed in the same run. A human merges.

## 5. Assumptions

Node 22 is available on the runner. Unit tests do not need Postgres. The API key can call the pinned CLI with `claude-opus-4-8`. The pull request branch is in this repository, so `GITHUB_TOKEN` can push to it. Review comments and the diff are untrusted.

## 6. Limitations

The model can write a different test on each run. A hostile diff can still confuse it. Fork pull requests are skipped because they cannot see the secret. Dependabot is skipped for the same reason. Each pull request spends a model call.

`--force` is required for print mode to write files. It also allows any command that is not on the deny list, so the allow list is not a lock. Deny rules still block `git push`, `git commit`, `gh`, `curl`, `wget`, `npm install`, `rm`, environment files, workflows, skills, and lockfiles. A source file such as `frontend/src/App.tsx` is not on that deny list, so `--force` can write it. The agent checkout has no stored git credentials. The hard stop is the guard job. It applies the patch on a clean checkout and fails the workflow if any path is outside `backend/tests/`, a frontend `*.test.ts` or `*.test.tsx` file, or `frontend/src/test/`. It also rejects `.only`, `.skip`, `it.todo`, and a net loss of assertions. Publish commits only when that job and verify both succeed. A failed guard leaves the pull request branch unchanged.

`GITHUB_TOKEN` can push the bot commit, and that push does not start CI or this workflow again. On the title-search pull request GitHub showed the follow-up as `action_required`. The tests were already green in verify, in the same run. A later bad bot commit would not be rechecked until a person pushes. The production fix is a GitHub App token. App tokens are allowed to trigger workflows, so the bot commit can run CI again. Section 7 names that token. The `[skip unit-test-agent]` trailer stays, so the app token does not start a second model call.

The shell sandbox is off so Vitest can run. The factory branch that runs after headers are sent, and the lifespan timeout that calls `process.exit`, stay untested on purpose.

## 7. Production extensions

Use a GitHub App installation token for the publish job when the bot commit must start CI. `GITHUB_TOKEN` is blocked from triggering workflows, which is why the follow-up run on pull request 2 ended as `action_required`. An app token is a normal actor, so the new commit runs `.github/workflows/ci.yml`. Keep `[skip unit-test-agent]` in the bot message so that token does not pay for a second model run. The same app token is what you use when the bot must act across repositories. Add mutation testing, a label or a comment command to start a run, dependency caching beyond npm, a recorded set of model runs, a rate limit, and an environment protection rule on the secret.

GitHub Agentic Workflows (`gh-aw`) compile a markdown workflow into Actions. The agent runs in that action, and safe outputs are the only way it can comment or open a pull request. An MCP variant would expose "read this file" and "run this test" as tools on a server, and the server would refuse every other call. This repo uses the Cursor CLI instead. The agent definition, the skills, and `.cursor/cli.json` are the same files a local `agent` run reads, and `CURSOR_API_KEY` is the only new secret. `gh-aw` would replace that client. An MCP server would be another process to deploy. The permission file plus the guard are the controls that stay in this repository. The CLI build we pinned cannot set a dollar budget, so the timeout and the file cap are the cost limit until a later CLI adds one.
