---
name: run-tests-and-coverage
description: Run the targeted test, then typecheck and coverage, and record the command output. Use after writing a test and again before the final report.
---

# Run tests and coverage

Every `tested` decision needs a command you ran. The report quotes that command. It does not invent a pass count.

## Steps

1. After each new or edited test file, run only that file.
   - Backend: `npm test --prefix backend -- tests/health.test.ts`
   - Frontend: `npm test --prefix frontend -- src/lib/http.test.ts`
2. Copy the command, the exit code, and a one-line summary (`2 passed` or the first failure line) into `evidence`.
3. When a new test fails, stop and use `fix-failing-test`. Do not start the next file.
4. After the last file, run the package you touched:
   - `npm run typecheck --prefix backend`
   - `npm run test:coverage --prefix backend`
   - The same two scripts with `--prefix frontend` when the frontend changed.
5. Read the totals with `node scripts/agent/coverage-summary.mjs --after backend/coverage/coverage-summary.json`. Put that command in `evidence` too.
6. If you did not run a command, leave it out. Write `notes` that the full coverage run was not completed. Do not type a percentage from memory.

The workflow runs typecheck and coverage again on a clean tree. Your evidence is the first proof. The workflow is the one that gets published.
