import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseVersionFile } from './install-cursor-cli.mjs';

function readJson(file, fallback) {
  if (!file) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function coverageLines(coverage) {
  const lines = [];
  if (!coverage) return lines;
  const packages = coverage.backend || coverage.frontend ? coverage : { total: coverage };
  for (const [name, metrics] of Object.entries(packages)) {
    if (!metrics?.statements) continue;
    lines.push(`- ${name}:`);
    for (const metric of ['statements', 'branches', 'functions', 'lines']) {
      const row = metrics[metric];
      if (!row || typeof row.before !== 'number') continue;
      const sign = row.delta > 0 ? '+' : '';
      lines.push(`  - ${metric}: ${row.before}% → ${row.after}% (${sign}${row.delta})`);
    }
  }
  return lines;
}

// Slash is excluded so a repo path is not treated as a blob. A slash splits the scan.
const BASE64_BLOB = /[A-Za-z0-9+]{40,}={0,2}/g;

export function sanitizeText(text, max = 400) {
  if (typeof text !== 'string') return '';
  const cleaned = text.replace(BASE64_BLOB, '[removed]').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
}

export function loadBudget(versionText) {
  const pin = parseVersionFile(versionText);
  return {
    version: pin.version,
    model: pin.model,
    timeoutSeconds: Number(pin['timeout-seconds']),
    maxSourceFiles: Number(pin['max-source-files']),
    maxFixAttempts: Number(pin['max-fix-attempts']),
  };
}

export function renderReport({ report, coverage, tests, verify, failure, budget }) {
  const plan = Array.isArray(report?.plan) ? report.plan : [];
  const decisions = Array.isArray(report?.decisions) ? report.decisions : [];
  const skills = Array.isArray(report?.skillsUsed) ? report.skillsUsed : [];
  const written = Array.isArray(report?.testFilesWritten) ? report.testFilesWritten : [];
  const bugs = Array.isArray(report?.suspectedBugs) ? report.suspectedBugs : [];
  const evidence = Array.isArray(report?.evidence) ? report.evidence : [];
  const lines = ['## Unit-test agent', ''];
  if (failure) lines.push(failure, '');
  lines.push('### Plan', '');
  if (!plan.length) lines.push('No plan was recorded.', '');
  for (const item of plan) lines.push(`- \`${item.path}\`: ${item.action}. ${sanitizeText(item.reason ?? '', 240)}`);
  lines.push('', '### Decisions', '');
  if (!decisions.length) lines.push('No per-file decisions were recorded.', '');
  for (const decision of decisions) {
    const files = decision.testFiles?.length ? ` Tests: ${decision.testFiles.join(', ')}.` : '';
    lines.push(`- \`${decision.path}\`: ${decision.decision}. ${sanitizeText(decision.reason ?? '', 240)}${files}`);
  }
  lines.push('', '### Skills', '');
  lines.push(skills.length ? skills.map((skill) => `\`${skill}\``).join(', ') : 'None recorded.');
  lines.push('', '### Tests written', '');
  lines.push(written.length ? written.map((file) => `- \`${file}\``).join('\n') : 'None.');
  lines.push('', '### Evidence from the agent', '');
  if (!evidence.length) lines.push('The agent did not record a test command. The workflow runs below are the executed proof.', '');
  for (const item of evidence) {
    lines.push(`- \`${sanitizeText(item.command ?? '', 180)}\` exited ${item.exitCode}. ${sanitizeText(item.summary ?? '', 180)}`);
  }
  lines.push('', '### Test runs from this workflow', '');
  if (tests) {
    lines.push(`- Changed tests: ${tests.ok ? 'passed' : 'failed'} across ${tests.runs ?? 0} run(s).`);
    lines.push(`- Flaky check: ${tests.flaky ? 'failed' : 'passed'}.`);
  } else lines.push('- Changed-test run was not recorded.');
  if (verify) lines.push(`- Verify: ${verify.ok ? 'passed' : 'failed'}.`);
  lines.push('', '### Coverage', '');
  const renderedCoverage = coverageLines(coverage);
  lines.push(renderedCoverage.length ? renderedCoverage.join('\n') : 'Coverage delta was not recorded.');
  if (bugs.length) {
    lines.push('', '### Suspected bugs', '');
    for (const bug of bugs) lines.push(`- ${sanitizeText(String(bug), 240)}`);
  }
  const notes = sanitizeText(report?.notes);
  if (notes) lines.push('', '### Notes', '', notes);
  lines.push('', '### Cost', '');
  if (!budget) {
    lines.push('Budget was not recorded.', '');
  } else {
    lines.push(`- Model: \`${budget.model}\`. CLI pin: \`${budget.version}\`.`);
    lines.push(`- Timeout: ${budget.timeoutSeconds} seconds. This CLI build has no max-turn flag, so the process is killed at the timeout.`);
    lines.push(`- Turn budget: ${budget.maxSourceFiles} source files, ${budget.maxFixAttempts} retries on a failing new test.`);
    lines.push('- Read denies do not stop `node`, `cat`, or `npm` while `--force` is on. The file cap and the retry script are what the workflow enforces.');
    lines.push('- A red test run does not commit. The bot commits to the pull request branch and never merges.');
  }
  lines.push('', 'Artifacts: `unit-test-agent-output` and `unit-test-verify` on this workflow run.');
  return `${lines.join('\n')}\n`;
}

function flag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const markdown = renderReport({
    report: readJson(flag('--report'), {}),
    coverage: readJson(flag('--coverage'), null),
    tests: readJson(flag('--tests'), null),
    verify: readJson(flag('--verify'), null),
    failure: flag('--failure'),
    budget: loadBudget(readFileSync(new URL('./cursor-cli.version', import.meta.url), 'utf8')),
  });
  process.stdout.write(markdown);
}
