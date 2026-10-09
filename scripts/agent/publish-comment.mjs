import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const COMMENT_MARKER = '<!-- unit-test-agent-report -->';

export function findStickyComment(comments, marker = COMMENT_MARKER) {
  return comments.find((comment) => typeof comment.body === 'string' && comment.body.includes(marker)) ?? null;
}

export function commentBody(markdown, marker = COMMENT_MARKER) {
  return `${marker}\n${markdown}`;
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const repo = process.env.REPO;
  const pr = process.env.PR_NUMBER;
  const bodyFile = process.argv[2];
  if (!repo || !pr || !bodyFile) {
    console.error('usage: REPO= PR_NUMBER= node scripts/agent/publish-comment.mjs report.md');
    process.exit(1);
  }
  const body = commentBody(readFileSync(bodyFile, 'utf8'));
  const listed = gh(['api', '--paginate', `repos/${repo}/issues/${pr}/comments`, '--jq', '.[] | {id: .id, body: .body}']);
  const comments = listed.trim() ? listed.trim().split('\n').map((line) => JSON.parse(line)) : [];
  const existing = findStickyComment(comments);
  if (existing) {
    gh(['api', '--method', 'PATCH', `repos/${repo}/issues/comments/${existing.id}`, '-f', `body=${body}`]);
    console.log(`updated comment ${existing.id}`);
  } else {
    gh(['api', '--method', 'POST', `repos/${repo}/issues/${pr}/comments`, '-f', `body=${body}`]);
    console.log('created comment');
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, readFileSync(bodyFile));
  }
}
