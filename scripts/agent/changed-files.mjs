import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadBudget } from './render-report.mjs';

const BACKEND_TESTS = {
  router: 'backend/tests/router.test.ts',
  health: 'backend/tests/health.test.ts',
  factory: 'backend/tests/factory.test.ts',
  config: 'backend/tests/config.test.ts',
  lifespan: 'backend/tests/lifespan.test.ts',
  database: 'backend/tests/database.test.ts',
  main: 'backend/tests/main.test.ts',
  repository: 'backend/tests/repository.test.ts',
  validators: 'backend/tests/validators.test.ts',
  mappers: 'backend/tests/mappers.test.ts',
};

function skipped(path, area, kind, reason) {
  return { path, area, kind, testable: false, reason, testPaths: [] };
}

function areaOf(path) {
  if (path.startsWith('backend/')) return 'backend';
  if (path.startsWith('frontend/')) return 'frontend';
  return 'repo';
}

function backendTestPath(source) {
  const base = source.split('/').pop().replace(/\.ts$/, '');
  return BACKEND_TESTS[base] ?? `backend/tests/${base}.test.ts`;
}

function frontendTestPath(source) {
  if (source.endsWith('.tsx')) return source.replace(/\.tsx$/, '.test.tsx');
  return source.replace(/\.ts$/, '.test.ts');
}

export function classifyPath(filePath) {
  const area = areaOf(filePath);
  if (filePath.split('/').includes('..')) return skipped(filePath, area, 'other', 'Path escapes the repository.');
  if (filePath.startsWith('backend/tests/') || filePath.startsWith('frontend/src/test/') || /\.test\.tsx?$/.test(filePath)) {
    return skipped(filePath, area, 'test', 'Test file or test helper.');
  }
  if (/\.stories\.tsx?$/.test(filePath)) return skipped(filePath, area, 'story', 'Storybook story.');
  if (filePath.endsWith('.css') || filePath.endsWith('.styles.ts')) return skipped(filePath, area, 'style', 'Styling only.');
  if (filePath.endsWith('.d.ts') || filePath.endsWith('.types.ts') || filePath.endsWith('/types.ts')) {
    return skipped(filePath, area, 'types', 'Type-only module.');
  }
  if (filePath.startsWith('.github/') || filePath.startsWith('.cursor/') || filePath.startsWith('scripts/') || filePath.startsWith('backend/prisma/') || /(^|\/)package(-lock)?\.json$/.test(filePath) || filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
    return skipped(filePath, area, 'config', 'Config, workflow, or lockfile.');
  }
  if (filePath.endsWith('.md')) return skipped(filePath, area, 'docs', 'Documentation.');
  if (filePath === 'frontend/src/main.tsx') {
    return skipped(filePath, area, 'source', 'Frontend bootstrap. Excluded from the coverage gate.');
  }
  if (filePath.startsWith('frontend/src/design-system/')) {
    return skipped(filePath, area, 'source', 'Design-system presentation. Covered outside this agent.');
  }
  if (filePath.startsWith('backend/src/') && filePath.endsWith('.ts')) {
    return { path: filePath, area, kind: 'source', testable: true, reason: 'Backend runtime module.', testPaths: [backendTestPath(filePath)] };
  }
  if (filePath.startsWith('frontend/src/') && (filePath.endsWith('.ts') || filePath.endsWith('.tsx'))) {
    return { path: filePath, area, kind: 'source', testable: true, reason: 'Frontend runtime module.', testPaths: [frontendTestPath(filePath)] };
  }
  return skipped(filePath, area, 'other', 'Not a runtime source file.');
}

export function reportFromNameStatus(text, base, head) {
  const files = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const status = parts[0].slice(0, 1);
    const filePath = parts.length === 3 ? parts[2] : parts[1];
    files.push({ status, ...classifyPath(filePath) });
  }
  return { base, head, files };
}

export function applyFileBudget(report, maxSourceFiles) {
  const cap = Number(maxSourceFiles);
  if (!Number.isFinite(cap) || cap < 1) return report;
  let kept = 0;
  const files = report.files.map((file) => {
    if (!file.testable) return file;
    kept += 1;
    if (kept <= cap) return file;
    return {
      ...file,
      testable: false,
      testPaths: [],
      reason: `Run budget: only ${cap} source files per workflow.`,
    };
  });
  return { ...report, files };
}

function flag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const base = flag('--base') ?? 'origin/main';
  const head = flag('--head') ?? 'HEAD';
  const text = execFileSync('git', ['diff', '--name-status', '--find-renames', `${base}...${head}`], { encoding: 'utf8' });
  const budget = loadBudget(readFileSync(new URL('./cursor-cli.version', import.meta.url), 'utf8'));
  const report = applyFileBudget(reportFromNameStatus(text, base, head), budget.maxSourceFiles);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
