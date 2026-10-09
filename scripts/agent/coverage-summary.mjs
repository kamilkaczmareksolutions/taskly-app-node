import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const METRICS = ['statements', 'branches', 'functions', 'lines'];

function round(value) {
  return Math.round(value * 100) / 100;
}

export function readSummary(file) {
  const total = JSON.parse(readFileSync(file, 'utf8')).total;
  const summary = {};
  for (const metric of METRICS) summary[metric] = total[metric].pct;
  return summary;
}

export function coverageDelta(before, after) {
  const delta = {};
  for (const metric of METRICS) {
    delta[metric] = {
      before: before[metric],
      after: after[metric],
      delta: round(after[metric] - before[metric]),
    };
  }
  return delta;
}

function flag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const beforeFile = flag('--before');
  const afterFile = flag('--after');
  if (!afterFile) {
    console.error('usage: node scripts/agent/coverage-summary.mjs --after summary.json [--before base.json]');
    process.exit(1);
  }
  const after = readSummary(afterFile);
  const payload = beforeFile ? coverageDelta(readSummary(beforeFile), after) : after;
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
