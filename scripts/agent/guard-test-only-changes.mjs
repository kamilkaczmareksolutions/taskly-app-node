import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ALLOWED = [
  /^backend\/tests\/.+\.test\.ts$/,
  /^frontend\/src\/.+\.test\.ts$/,
  /^frontend\/src\/.+\.test\.tsx$/,
  // The one shared hook wrapper. setup.ts and fixture files stay out.
  /^frontend\/src\/test\/queryWrapper\.tsx$/,
];

export function disallowedPaths(paths) {
  return paths.filter((filePath) => {
    if (!filePath || filePath.split('/').includes('..')) return true;
    return !ALLOWED.some((pattern) => pattern.test(filePath));
  });
}

export function stagedPaths() {
  const text = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' });
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const paths = process.argv.slice(2);
  const changed = paths.length ? paths : stagedPaths();
  const blocked = disallowedPaths(changed);
  if (blocked.length) {
    console.error('Non-test paths are present:');
    for (const filePath of blocked) console.error(`  ${filePath}`);
    process.exit(1);
  }
  console.log(`guard ok (${changed.length} path${changed.length === 1 ? '' : 's'})`);
}
