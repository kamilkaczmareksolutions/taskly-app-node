import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function groupTestFiles(paths) {
  const groups = { backend: [], frontend: [] };
  for (const filePath of paths) {
    if (filePath.startsWith('backend/tests/') && filePath.endsWith('.test.ts')) {
      groups.backend.push(filePath.slice('backend/'.length));
    } else if (filePath.startsWith('frontend/src/') && /\.test\.tsx?$/.test(filePath)) {
      groups.frontend.push(filePath.slice('frontend/'.length));
    }
  }
  return groups;
}

function runOnce(cwd, files) {
  execFileSync('npx', ['vitest', 'run', ...files], { cwd, stdio: 'inherit' });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const text = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' });
  const groups = groupTestFiles(text.split('\n').map((line) => line.trim()).filter(Boolean));
  const commands = [];
  let ok = true;
  let flaky = false;
  const entries = [
    ['backend', 'backend'],
    ['frontend', 'frontend'],
  ];
  for (const [name, cwd] of entries) {
    const files = groups[name];
    if (!files.length) continue;
    commands.push(`${name}: ${files.join(' ')}`);
    try {
      runOnce(cwd, files);
    } catch {
      ok = false;
      break;
    }
    try {
      runOnce(cwd, files);
    } catch {
      ok = false;
      flaky = true;
      break;
    }
  }
  const result = { ok, flaky, runs: commands.length ? 2 : 0, commands };
  const payload = `${JSON.stringify(result, null, 2)}\n`;
  if (process.argv[2]) writeFileSync(process.argv[2], payload);
  else process.stdout.write(payload);
  if (!ok) process.exit(1);
}
