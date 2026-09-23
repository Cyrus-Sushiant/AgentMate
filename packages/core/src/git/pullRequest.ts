/**
 * Pull request data as the app uses it, parsed from `gh pr view --json` and the GitHub GraphQL
 * API, plus the prompts that hand a PR to an agent. Everything here is pure so it can be tested
 * against captured gh output.
 */

export type PullRequestState = 'OPEN' | 'CLOSED' | 'MERGED';
export type MergeMethod = 'squash' | 'merge' | 'rebase';

export interface PrCheck {
  name: string;
  /** The Actions workflow the check belongs to, null for external status checks. */
  workflow: string | null;
  /** GitHub's lowercase run status (`completed`, `in_progress`, `queued`, `pending`...). */
  status: string;
  /** GitHub's lowercase conclusion once completed (`success`, `failure`...), else null. */
  conclusion: string | null;
  detailsUrl: string | null;
  /** The Actions run behind the check, when its link points at one. */
  runId: number | null;
}

export interface PrReviewComment {
  author: string;
  body: string;
  createdAt: string;
  url: string;
}

export interface PrReviewThread {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  comments: PrReviewComment[];
}

export interface PullRequestInfo {
  number: number;
  title: string;
  url: string;
  state: PullRequestState;
  isDraft: boolean;
  base: string;
  head: string;
  /** `MERGEABLE`, `CONFLICTING` or `UNKNOWN` while GitHub is still working it out. */
  mergeable: string;
  /** `CLEAN`, `BLOCKED`, `BEHIND`, `DIRTY`, `UNSTABLE`... */
  mergeStateStatus: string;
  /** `APPROVED`, `CHANGES_REQUESTED`, `REVIEW_REQUIRED`, or null when no review is needed. */
  reviewDecision: string | null;
  additions: number;
  deletions: number;
  checks: PrCheck[];
  threads: PrReviewThread[];
}

export interface ChecksSummary {
  total: number;
  failed: number;
  running: number;
  passed: number;
  other: number;
}

export type MergeBlockerKind =
  | 'not-open'
  | 'draft'
  | 'conflicts'
  | 'failing-checks'
  | 'running-checks'
  | 'changes-requested'
  | 'review-required'
  | 'unresolved-threads';

export interface MergeBlocker {
  kind: MergeBlockerKind;
  message: string;
}

/** PR comments that ask a review bot to look at the pull request. Editable in Settings. */
export const DEFAULT_REVIEW_COMMANDS: readonly string[] = [
  '@claude review',
  '/gemini review',
  '@coderabbitai review',
  '@codex review',
];

export function normalizeReviewCommands(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_REVIEW_COMMANDS];
  const commands = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(commands)];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

function runIdFromUrl(url: string | null): number | null {
  const match = url?.match(/\/actions\/runs\/(\d+)/);
  return match ? Number(match[1]) : null;
}

/** Status contexts only have a state, so it is spread over status and conclusion like a run. */
function contextState(state: string): { status: string; conclusion: string | null } {
  switch (state) {
    case 'SUCCESS':
      return { status: 'completed', conclusion: 'success' };
    case 'FAILURE':
    case 'ERROR':
      return { status: 'completed', conclusion: 'failure' };
    case 'EXPECTED':
    case 'PENDING':
      return { status: 'pending', conclusion: null };
    default:
      return { status: 'completed', conclusion: state.toLowerCase() || null };
  }
}

export function parseCheckRollup(rollup: unknown): PrCheck[] {
  if (!Array.isArray(rollup)) return [];
  const checks: PrCheck[] = [];
  for (const item of rollup) {
    if (!isObject(item)) continue;
    if (item.__typename === 'CheckRun') {
      const detailsUrl = str(item.detailsUrl) || null;
      checks.push({
        name: str(item.name),
        workflow: str(item.workflowName) || null,
        status: str(item.status).toLowerCase() || 'completed',
        conclusion: str(item.conclusion).toLowerCase() || null,
        detailsUrl,
        runId: runIdFromUrl(detailsUrl),
      });
    } else if (item.__typename === 'StatusContext') {
      const detailsUrl = str(item.targetUrl) || null;
      checks.push({
        name: str(item.context),
        workflow: null,
        ...contextState(str(item.state)),
        detailsUrl,
        runId: runIdFromUrl(detailsUrl),
      });
    }
  }
  return checks;
}

type CheckBucket = 'failed' | 'running' | 'passed' | 'other';

/** Same buckets as the pipeline run tone, so checks and runs read alike. */
export function checkBucket(check: Pick<PrCheck, 'status' | 'conclusion'>): CheckBucket {
  if (check.status !== 'completed') return 'running';
  if (check.conclusion === 'success') return 'passed';
  if (
    check.conclusion === 'failure' ||
    check.conclusion === 'timed_out' ||
    check.conclusion === 'startup_failure' ||
    check.conclusion === 'action_required'
  ) {
    return 'failed';
  }
  return 'other';
}

export function summarizeChecks(checks: PrCheck[]): ChecksSummary {
  const summary: ChecksSummary = {
    total: checks.length,
    failed: 0,
    running: 0,
    passed: 0,
    other: 0,
  };
  for (const check of checks) summary[checkBucket(check)] += 1;
  return summary;
}

export function parsePrView(json: unknown): PullRequestInfo {
  const data = isObject(json) ? json : {};
  const state = str(data.state);
  return {
    number: num(data.number),
    title: str(data.title),
    url: str(data.url),
    state: state === 'MERGED' || state === 'CLOSED' ? state : 'OPEN',
    isDraft: data.isDraft === true,
    base: str(data.baseRefName),
    head: str(data.headRefName),
    mergeable: str(data.mergeable) || 'UNKNOWN',
    mergeStateStatus: str(data.mergeStateStatus) || 'UNKNOWN',
    reviewDecision: str(data.reviewDecision) || null,
    additions: num(data.additions),
    deletions: num(data.deletions),
    checks: parseCheckRollup(data.statusCheckRollup),
    threads: [],
  };
}

function nodes(value: unknown): unknown[] {
  return isObject(value) && Array.isArray(value.nodes) ? value.nodes : [];
}

export function parseReviewThreads(json: unknown): PrReviewThread[] {
  const data = isObject(json) ? json.data : undefined;
  const repository = isObject(data) ? data.repository : undefined;
  const pullRequest = isObject(repository) ? repository.pullRequest : undefined;
  const threads = isObject(pullRequest) ? nodes(pullRequest.reviewThreads) : [];
  return threads.filter(isObject).map((thread) => ({
    id: str(thread.id),
    isResolved: thread.isResolved === true,
    isOutdated: thread.isOutdated === true,
    path: str(thread.path),
    line: typeof thread.line === 'number' ? thread.line : null,
    comments: nodes(thread.comments)
      .filter(isObject)
      .map((comment) => ({
        // GitHub reports deleted accounts as a null author and shows them as "ghost".
        author: isObject(comment.author) ? str(comment.author.login) || 'ghost' : 'ghost',
        body: str(comment.body),
        createdAt: str(comment.createdAt),
        url: str(comment.url),
      })),
  }));
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Why the PR can't be merged yet, in the order worth fixing them. Empty means it can. */
export function mergeBlockers(pr: PullRequestInfo): MergeBlocker[] {
  if (pr.state !== 'OPEN') {
    return [{ kind: 'not-open', message: `This pull request is ${pr.state.toLowerCase()}.` }];
  }
  const blockers: MergeBlocker[] = [];
  if (pr.isDraft) {
    blockers.push({ kind: 'draft', message: 'It is still a draft. Mark it ready for review.' });
  }
  if (pr.mergeable === 'CONFLICTING' || pr.mergeStateStatus === 'DIRTY') {
    blockers.push({ kind: 'conflicts', message: `It has conflicts with ${pr.base}.` });
  }
  const summary = summarizeChecks(pr.checks);
  if (summary.failed > 0) {
    blockers.push({
      kind: 'failing-checks',
      message: `${plural(summary.failed, 'check')} failed.`,
    });
  }
  if (summary.running > 0) {
    blockers.push({
      kind: 'running-checks',
      message: `${plural(summary.running, 'check')} still running.`,
    });
  }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    blockers.push({ kind: 'changes-requested', message: 'A reviewer requested changes.' });
  } else if (pr.reviewDecision === 'REVIEW_REQUIRED') {
    blockers.push({ kind: 'review-required', message: 'It needs an approving review.' });
  }
  // Open threads only stop a merge when branch protection says so, and GitHub signals that
  // as BLOCKED without saying why, so they are named only when nothing else explains it.
  const unresolved = pr.threads.filter((thread) => !thread.isResolved).length;
  if (unresolved > 0 && pr.mergeStateStatus === 'BLOCKED') {
    blockers.push({
      kind: 'unresolved-threads',
      message: `${plural(unresolved, 'review thread')} still open.`,
    });
  }
  return blockers;
}

/** Hands the unresolved review comments to an agent to fix in the working tree. */
export function buildReviewFixPrompt(pr: PullRequestInfo, threads: PrReviewThread[]): string {
  const open = threads.filter((thread) => !thread.isResolved);
  const lines = [
    `Pull request #${pr.number} "${pr.title}" (${pr.head} into ${pr.base}) has review comments to address.`,
    '',
    'Work through each comment below in this repository. Make the change the reviewer asks for, or, when you disagree, leave the code as it is and say why. Keep each change focused on its comment, run the relevant checks afterwards, and finish with a short list saying what you did for each comment.',
    '',
  ];
  open.forEach((thread, index) => {
    const where = thread.line ? `${thread.path}:${thread.line}` : thread.path;
    lines.push(
      `${index + 1}. ${where}${thread.isOutdated ? ' (on an older version of the file)' : ''}`,
    );
    for (const comment of thread.comments) {
      lines.push(`   @${comment.author}: ${comment.body.trim().replace(/\n/g, '\n   ')}`);
    }
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

/** A read-only review of the PR diff, to be posted as a PR comment. */
export function buildLocalReviewPrompt(pr: PullRequestInfo, diff: string): string {
  return [
    `Review pull request #${pr.number} "${pr.title}" (${pr.head} into ${pr.base}) as a careful senior engineer.`,
    'Do not edit any files. Read the repository only where you need context for the diff.',
    '',
    'Look for bugs, missing edge cases, security problems and anything that would break existing behaviour. Skip style nits a formatter would catch.',
    'Write the review in Markdown for a GitHub comment: start with a one-line verdict, then a list of findings, each naming the file and line, what is wrong and how to fix it. If you find nothing worth changing, say so in one line.',
    '',
    'The diff:',
    '```diff',
    diff.trim(),
    '```',
  ].join('\n');
}

/** Asks for a PR title and description from the branch's commits. */
export function buildPrTextPrompt(base: string, subjects: string[], diffStat: string): string {
  return [
    `Write a GitHub pull request title and description for a branch that is about to be merged into ${base}.`,
    'Do not read or edit any files; judge only from the information below.',
    '',
    'Answer in exactly this format, with nothing before it:',
    'TITLE: <a short summary under 72 characters, no trailing period>',
    'BODY:',
    '<a sentence or two on what changed and why, then a few "- " bullets for the notable changes>',
    '',
    'Commits on the branch:',
    ...(subjects.length > 0 ? subjects.map((subject) => `- ${subject}`) : ['(none)']),
    '',
    'Diff summary:',
    diffStat.trim() || '(empty)',
  ].join('\n');
}

export function parsePrText(text: string): { title: string; body: string } {
  const trimmed = text.trim();
  const title = trimmed.match(/^\s*TITLE:\s*(.+)$/im);
  if (title) {
    const bodyMatch = trimmed.match(/^\s*BODY:\s*\n?([\s\S]*)$/im);
    return { title: title[1]?.trim() ?? '', body: bodyMatch?.[1]?.trim() ?? '' };
  }
  const [first = '', ...rest] = trimmed.split('\n');
  return { title: first.replace(/^#+\s*/, '').trim(), body: rest.join('\n').trim() };
}
