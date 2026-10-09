import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadBudget } from './render-report.mjs';

export const ATTEMPT_LOG = 'agent-attempts.json';

export function decideAttempt(previousFailures, maxAttempts) {
  const next = previousFailures + 1;
  return { run: next <= maxAttempts, next };
}

function readLog(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function runNpm(cwd, args) {
  const env = { ...process.env };
  delete env.CURSOR_API_KEY;
  const result = spawnSync('npm', args, { cwd, stdio: 'inherit', env });
  return result.status ?? 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [mode, pkg, file] = process.argv.slice(2);
  const budget = loadBudget(readFileSync(new URL('./cursor-cli.version', import.meta.url), 'utf8'));
  if (mode === 'typecheck' && pkg) {
    process.exit(runNpm(pkg, ['run', 'typecheck']));
  }
  if (mode === 'coverage' && pkg) {
    process.exit(runNpm(pkg, ['run', 'test:coverage']));
  }
  if (mode !== 'test' || !pkg || !file) {
    console.error('usage: node scripts/agent/bounded-test.mjs test <backend|frontend> <test-file>');
    process.exit(1);
  }
  const log = readLog(ATTEMPT_LOG);
  const key = `${pkg}:${file}`;
  const choice = decideAttempt(log[key] ?? 0, budget.maxFixAttempts);
  if (!choice.run) {
    console.error(`Retry budget exhausted for ${file} after ${budget.maxFixAttempts} failed runs.`);
    process.exit(2);
  }
  const status = runNpm(pkg, ['test', '--', file]);
  if (status !== 0) {
    log[key] = choice.next;
    writeFileSync(ATTEMPT_LOG, `${JSON.stringify(log, null, 2)}\n`);
  }
  process.exit(status);
}
