import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classifyPath, reportFromNameStatus } from './changed-files.mjs';
import { auditDiff } from './check-no-focus-skip.mjs';
import { coverageDelta } from './coverage-summary.mjs';
import { decide } from './decide.mjs';
import { disallowedPaths } from './guard-test-only-changes.mjs';
import { assertChecksum, parseVersionFile } from './install-cursor-cli.mjs';
import { COMMENT_MARKER, commentBody, findStickyComment } from './publish-comment.mjs';
import { filesContainingSecret } from './reject-secret.mjs';
import { renderReport } from './render-report.mjs';
import { groupTestFiles } from './run-changed-tests.mjs';

const ready = {
  eventName: 'pull_request',
  headRepo: 'acme/taskly',
  baseRepo: 'acme/taskly',
  actor: 'octocat',
  prUser: 'octocat',
  isDraft: false,
  commitMessage: 'feat: add search',
  commitAuthor: 'octocat',
  hasKey: true,
};

test('decide skips forks, Dependabot, drafts, bot commits, and a missing key', () => {
  assert.equal(decide({ ...ready, headRepo: 'other/taskly' }).reason, 'fork PRs are not processed: secrets unavailable by design');
  assert.equal(decide({ ...ready, actor: 'dependabot[bot]' }).shouldRun, false);
  assert.equal(decide({ ...ready, prUser: 'dependabot[bot]' }).shouldRun, false);
  assert.match(decide({ ...ready, isDraft: true }).reason, /Draft/);
  assert.equal(decide({ ...ready, commitMessage: 'test: add [skip unit-test-agent]' }).shouldRun, false);
  assert.equal(decide({ ...ready, commitAuthor: 'github-actions[bot]' }).shouldRun, false);
  const missing = decide({ ...ready, hasKey: false });
  assert.equal(missing.notice, true);
  assert.match(missing.reason, /CURSOR_API_KEY not configured/);
  assert.equal(decide(ready).shouldRun, true);
});

test('classify maps source to the repo test paths and skips docs', () => {
  const router = classifyPath('backend/src/features/todos/router.ts');
  assert.equal(router.testable, true);
  assert.deepEqual(router.testPaths, ['backend/tests/router.test.ts']);
  const hook = classifyPath('frontend/src/features/todos/hooks/useTodosQuery.ts');
  assert.equal(hook.testPaths[0], 'frontend/src/features/todos/hooks/useTodosQuery.test.ts');
  assert.equal(classifyPath('README.md').testable, false);
  assert.equal(classifyPath('frontend/src/App.tsx').testable, true);
  assert.equal(classifyPath('frontend/src/App.stories.tsx').kind, 'story');
  assert.equal(classifyPath('backend/tests/router.test.ts').kind, 'test');
  const renamed = reportFromNameStatus('R100\told.ts\tbackend/src/core/config.ts\n', 'origin/main', 'HEAD');
  assert.equal(renamed.files[0].path, 'backend/src/core/config.ts');
  assert.equal(renamed.files[0].testPaths[0], 'backend/tests/config.test.ts');
});

test('guard allows test paths only', () => {
  assert.deepEqual(disallowedPaths([
    'backend/tests/router.test.ts',
    'backend/tests/fixture.ts',
    'frontend/src/lib/http.test.ts',
    'frontend/src/features/todos/TodoList.test.tsx',
    'frontend/src/test/queryWrapper.tsx',
  ]), []);
  assert.deepEqual(disallowedPaths(['backend/src/factory.ts', 'frontend/src/App.tsx', '../secrets']), [
    'backend/src/factory.ts',
    'frontend/src/App.tsx',
    '../secrets',
  ]);
});

test('focus and deleted assertions fail the diff audit', () => {
  const added = [
    'diff --git a/backend/tests/router.test.ts b/backend/tests/router.test.ts',
    '--- a/backend/tests/router.test.ts',
    '+++ b/backend/tests/router.test.ts',
    '@@ -1 +1,2 @@',
    ' it("lists", () => {});',
    '+it.only("focus", () => {});',
  ].join('\n');
  assert.match(auditDiff(added).join('\n'), /focused, skipped, or todo/);
  const removed = [
    'diff --git a/backend/tests/router.test.ts b/backend/tests/router.test.ts',
    '--- a/backend/tests/router.test.ts',
    '+++ b/backend/tests/router.test.ts',
    '@@ -1 +1 @@',
    '-  expect(response.status).toBe(200);',
    '+  expect(response.status).toBeDefined();',
  ].join('\n');
  assert.equal(auditDiff(removed).length, 0);
  const deleted = [
    'diff --git a/backend/tests/router.test.ts b/backend/tests/router.test.ts',
    '--- a/backend/tests/router.test.ts',
    '+++ b/backend/tests/router.test.ts',
    '@@ -1 +0,0 @@',
    '-expect(response.status).toBe(200);',
  ].join('\n');
  assert.match(auditDiff(deleted).join('\n'), /removed existing/);
  const created = [
    'diff --git a/backend/tests/health.test.ts b/backend/tests/health.test.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/backend/tests/health.test.ts',
    '@@ -0,0 +1 @@',
    '+expect(response.body).toEqual({ status: "ok" });',
  ].join('\n');
  assert.deepEqual(auditDiff(created), []);
});

test('coverage delta and the report quote recorded evidence', () => {
  const delta = coverageDelta(
    { statements: 30, branches: 33, functions: 40, lines: 33 },
    { statements: 92, branches: 88, functions: 95, lines: 93 },
  );
  assert.equal(delta.statements.delta, 62);
  const markdown = renderReport({
    report: {
      plan: [{ path: 'README.md', action: 'skip', reason: 'Documentation.' }],
      decisions: [{ path: 'README.md', decision: 'skipped', reason: 'Documentation.', testFiles: [] }],
      skillsUsed: ['analyze-pr-diff'],
      evidence: [{ command: 'npm test --prefix backend -- tests/health.test.ts', exitCode: 0, summary: '2 passed' }],
    },
    coverage: { backend: delta },
    tests: { ok: true, flaky: false, runs: 2 },
    verify: { ok: true },
  });
  assert.match(markdown, /Documentation/);
  assert.match(markdown, /2 passed/);
  assert.match(markdown, /30% → 92%/);
  assert.match(markdown, /Flaky check: passed/);
});

test('checksum comparison fails closed and the secret scan returns paths only', () => {
  assert.throws(() => assertChecksum('abc', 'def'), /checksum mismatch/);
  const pin = parseVersionFile('version=1\nurl=https://example.com/cli.tar.gz\nsha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nmodel=gpt-5\n');
  assert.equal(pin.model, 'gpt-5');
  const directory = mkdtempSync(path.join(tmpdir(), 'secret-scan-'));
  const file = path.join(directory, 'agent.patch');
  writeFileSync(file, 'prefix secret-value suffix');
  assert.deepEqual(filesContainingSecret('secret-value', [file, path.join(directory, 'missing')]), [file]);
  assert.throws(() => filesContainingSecret('', [file]), /without a key/);
});

test('sticky comments and changed test paths', () => {
  const comments = [{ id: 4, body: 'hello' }, { id: 9, body: `${COMMENT_MARKER}\nold` }];
  assert.equal(findStickyComment(comments).id, 9);
  assert.match(commentBody('report'), new RegExp(`^${COMMENT_MARKER}`));
  assert.deepEqual(groupTestFiles([
    'backend/tests/health.test.ts',
    'frontend/src/lib/http.test.ts',
    'frontend/src/App.tsx',
  ]), {
    backend: ['tests/health.test.ts'],
    frontend: ['src/lib/http.test.ts'],
  });
});
