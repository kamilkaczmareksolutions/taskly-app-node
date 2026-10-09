import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FORBIDDEN = /\b(?:it|test|describe|context)\.(?:only|skip|todo)\b|\b(?:xit|xtest|xdescribe|xcontext|fit|fdescribe)\s*\(/;
const ASSERTION = /^\s*(?:it|test|describe)(?:\.each)?\s*\(|\bexpect\s*\(/;
const WEAK = /\.toBe(?:Defined|Undefined|Truthy|Falsy)\s*\(|not\.toThrow\s*\(|\.toBeInstanceOf\s*\(/;

function isNewFile(hunks) {
  return hunks.some((line) => line.startsWith('--- /dev/null') || line.startsWith('--- a/dev/null'));
}

export function auditDiff(diffText) {
  const problems = [];
  const files = diffText.split(/^diff --git /m).slice(1);
  for (const chunk of files) {
    const header = chunk.split('\n', 1)[0];
    const match = header.match(/b\/(.+)$/);
    const filePath = match ? match[1].trim() : header.trim();
    const lines = chunk.split('\n');
    let removedAssertions = 0;
    let addedAssertions = 0;
    for (const line of lines) {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
      const body = line.slice(1);
      if (line.startsWith('+') && FORBIDDEN.test(body)) {
        problems.push(`${filePath}: added focused, skipped, or todo test`);
      }
      if (line.startsWith('+') && WEAK.test(body)) {
        problems.push(`${filePath}: added a weak assertion`);
      }
      if (!ASSERTION.test(body)) continue;
      if (line.startsWith('+')) addedAssertions += 1;
      if (line.startsWith('-')) removedAssertions += 1;
    }
    const created = lines.some((line) => line.startsWith('new file mode') || line.startsWith('--- /dev/null'));
    if (!created && !isNewFile(lines) && removedAssertions > addedAssertions) {
      problems.push(`${filePath}: removed existing tests or assertions`);
    }
  }
  return problems;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const file = process.argv[2];
  const diffText = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
  const problems = auditDiff(diffText);
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log('no focused, skipped, or deleted tests');
}
