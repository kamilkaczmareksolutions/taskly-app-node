import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadBudget } from './render-report.mjs';

const TEST_PATH = /^(?:backend\/tests\/.+|frontend\/src\/.+\.test\.tsx?|frontend\/src\/test\/.+)$/;

export function excessTestFiles(paths, maxSourceFiles) {
  const tests = paths.filter((filePath) => TEST_PATH.test(filePath));
  return tests.length > maxSourceFiles ? tests : [];
}

export function excessFailures(evidence, maxAttempts) {
  const counts = new Map();
  for (const item of evidence ?? []) {
    if (!item || item.exitCode === 0) continue;
    const key = item.command ?? '';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > maxAttempts).map(([command]) => command);
}

function stagedPaths() {
  const text = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' });
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const budget = loadBudget(readFileSync(new URL('./cursor-cli.version', import.meta.url), 'utf8'));
  const paths = process.argv.slice(2);
  const changed = paths.length ? paths : stagedPaths();
  const extra = excessTestFiles(changed, budget.maxSourceFiles);
  if (extra.length) {
    console.error(`More than ${budget.maxSourceFiles} test files in the patch:`);
    for (const filePath of extra) console.error(`  ${filePath}`);
    process.exit(1);
  }
  console.log(`budget ok (${changed.length} path${changed.length === 1 ? '' : 's'})`);
}
