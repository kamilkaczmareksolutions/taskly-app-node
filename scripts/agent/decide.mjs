import { pathToFileURL } from 'node:url';

const KEY_NOTICE = 'Unit-test agent skipped: CURSOR_API_KEY not configured. See SOLUTION.md#prerequisites';

export function decide(input) {
  const sameRepo = input.eventName !== 'pull_request' || input.headRepo === input.baseRepo;
  if (!sameRepo) {
    return { shouldRun: false, sameRepo: false, reason: 'fork PRs are not processed: secrets unavailable by design', notice: false };
  }
  if (input.actor === 'dependabot[bot]' || input.prUser === 'dependabot[bot]') {
    return { shouldRun: false, sameRepo, reason: 'Dependabot pull requests are skipped so the API key is never delivered to them.', notice: false };
  }
  if (input.isDraft) {
    return { shouldRun: false, sameRepo, reason: 'Draft pull requests are skipped.', notice: false };
  }
  if ((input.commitMessage ?? '').includes('[skip unit-test-agent]')) {
    return { shouldRun: false, sameRepo, reason: 'Head commit contains [skip unit-test-agent].', notice: false };
  }
  if (input.commitAuthor === 'github-actions[bot]') {
    return { shouldRun: false, sameRepo, reason: 'Head commit author is the bot.', notice: false };
  }
  if (!input.hasKey) {
    return { shouldRun: false, sameRepo, reason: KEY_NOTICE, notice: true };
  }
  const permission = input.authorPermission;
  if (permission && permission !== 'admin' && permission !== 'write') {
    return {
      shouldRun: false,
      sameRepo,
      reason: 'The pull request author does not have write access, so the agent does not run.',
      notice: false,
    };
  }
  return { shouldRun: true, sameRepo, reason: '', notice: false };
}

export function gateShouldRun(decision, report) {
  if (!decision.shouldRun) return decision;
  const testable = Array.isArray(report?.files) && report.files.some((file) => file.testable === true);
  if (testable) return decision;
  return { ...decision, shouldRun: false, reason: 'No testable source file changed.', notice: false };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const decision = decide({
    eventName: process.env.EVENT_NAME,
    headRepo: process.env.HEAD_REPO,
    baseRepo: process.env.BASE_REPO,
    actor: process.env.ACTOR,
    prUser: process.env.PR_USER,
    isDraft: process.env.IS_DRAFT === 'true',
    commitMessage: process.env.COMMIT_MESSAGE,
    commitAuthor: process.env.COMMIT_AUTHOR,
    hasKey: process.env.HAS_CURSOR_API_KEY === 'true',
    authorPermission: process.env.AUTHOR_PERMISSION,
  });
  process.stdout.write(`${JSON.stringify(decision)}\n`);
}
