import { describe, expect, it } from 'vitest';
import {
  buildLocalReviewPrompt,
  buildPrTextPrompt,
  buildReviewFixPrompt,
  DEFAULT_REVIEW_COMMANDS,
  mergeBlockers,
  normalizeReviewCommands,
  type PullRequestInfo,
  parseCheckRollup,
  parsePrText,
  parsePrView,
  parseReviewThreads,
  summarizeChecks,
} from './pullRequest.js';

// Trimmed from real `gh pr view --json ...` output.
const PR_VIEW = {
  number: 42,
  title: 'Add the pull request tab',
  url: 'https://github.com/acme/app/pull/42',
  state: 'OPEN',
  isDraft: false,
  baseRefName: 'master',
  headRefName: 'feature/pr-tab',
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  reviewDecision: 'APPROVED',
  additions: 120,
  deletions: 40,
  statusCheckRollup: [
    {
      __typename: 'CheckRun',
      name: 'test',
      workflowName: 'CI',
      status: 'COMPLETED',
      conclusion: 'FAILURE',
      detailsUrl: 'https://github.com/acme/app/actions/runs/987654/job/111',
    },
    {
      __typename: 'CheckRun',
      name: 'lint',
      workflowName: 'CI',
      status: 'IN_PROGRESS',
      conclusion: '',
      detailsUrl: 'https://github.com/acme/app/actions/runs/987654/job/112',
    },
    {
      __typename: 'StatusContext',
      context: 'ci/circleci',
      state: 'SUCCESS',
      targetUrl: 'https://circleci.com/gh/acme/app/1',
    },
  ],
};

const THREADS = {
  data: {
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: [
            {
              id: 'PRRT_1',
              isResolved: false,
              isOutdated: false,
              path: 'src/a.ts',
              line: 12,
              comments: {
                nodes: [
                  {
                    author: { login: 'reviewer' },
                    body: 'Please handle null here.',
                    createdAt: '2026-09-20T10:00:00Z',
                    url: 'https://github.com/acme/app/pull/42#discussion_r1',
                  },
                ],
              },
            },
            {
              id: 'PRRT_2',
              isResolved: true,
              isOutdated: true,
              path: 'src/b.ts',
              line: null,
              comments: { nodes: [{ author: null, body: 'nit', createdAt: '', url: '' }] },
            },
          ],
        },
      },
    },
  },
};

function pr(overrides: Partial<PullRequestInfo> = {}): PullRequestInfo {
  return {
    ...parsePrView({ ...PR_VIEW, statusCheckRollup: [] }),
    ...overrides,
  };
}

describe('parseCheckRollup', () => {
  it('maps check runs and status contexts onto GitHub run status and conclusion', () => {
    const checks = parseCheckRollup(PR_VIEW.statusCheckRollup);
    expect(checks).toEqual([
      {
        name: 'test',
        workflow: 'CI',
        status: 'completed',
        conclusion: 'failure',
        detailsUrl: 'https://github.com/acme/app/actions/runs/987654/job/111',
        runId: 987654,
      },
      {
        name: 'lint',
        workflow: 'CI',
        status: 'in_progress',
        conclusion: null,
        detailsUrl: 'https://github.com/acme/app/actions/runs/987654/job/112',
        runId: 987654,
      },
      {
        name: 'ci/circleci',
        workflow: null,
        status: 'completed',
        conclusion: 'success',
        detailsUrl: 'https://circleci.com/gh/acme/app/1',
        runId: null,
      },
    ]);
  });

  it('treats pending and errored status contexts', () => {
    const [pending, errored] = parseCheckRollup([
      { __typename: 'StatusContext', context: 'a', state: 'PENDING', targetUrl: null },
      { __typename: 'StatusContext', context: 'b', state: 'ERROR', targetUrl: null },
    ]);
    expect(pending).toMatchObject({ status: 'pending', conclusion: null });
    expect(errored).toMatchObject({ status: 'completed', conclusion: 'failure' });
  });

  it('ignores junk', () => {
    expect(parseCheckRollup(null)).toEqual([]);
    expect(parseCheckRollup([null, 3, {}])).toEqual([]);
  });
});

describe('summarizeChecks', () => {
  it('counts each bucket', () => {
    const summary = summarizeChecks([
      ...parseCheckRollup(PR_VIEW.statusCheckRollup),
      {
        name: 'x',
        workflow: null,
        status: 'completed',
        conclusion: 'skipped',
        detailsUrl: null,
        runId: null,
      },
    ]);
    expect(summary).toEqual({ total: 4, failed: 1, running: 1, passed: 1, other: 1 });
  });
});

describe('parsePrView', () => {
  it('maps the gh json', () => {
    const info = parsePrView(PR_VIEW);
    expect(info).toMatchObject({
      number: 42,
      title: 'Add the pull request tab',
      state: 'OPEN',
      isDraft: false,
      base: 'master',
      head: 'feature/pr-tab',
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      reviewDecision: 'APPROVED',
      additions: 120,
      deletions: 40,
      threads: [],
    });
    expect(info.checks).toHaveLength(3);
  });

  it('normalizes a missing review decision to null', () => {
    expect(parsePrView({ ...PR_VIEW, reviewDecision: '' }).reviewDecision).toBeNull();
  });
});

describe('parseReviewThreads', () => {
  it('reads threads and their comments', () => {
    const threads = parseReviewThreads(THREADS);
    expect(threads).toEqual([
      {
        id: 'PRRT_1',
        isResolved: false,
        isOutdated: false,
        path: 'src/a.ts',
        line: 12,
        comments: [
          {
            author: 'reviewer',
            body: 'Please handle null here.',
            createdAt: '2026-09-20T10:00:00Z',
            url: 'https://github.com/acme/app/pull/42#discussion_r1',
          },
        ],
      },
      {
        id: 'PRRT_2',
        isResolved: true,
        isOutdated: true,
        path: 'src/b.ts',
        line: null,
        comments: [{ author: 'ghost', body: 'nit', createdAt: '', url: '' }],
      },
    ]);
  });

  it('returns nothing for an unexpected shape', () => {
    expect(parseReviewThreads({})).toEqual([]);
  });
});

describe('mergeBlockers', () => {
  it('is empty for a clean, approved, green PR', () => {
    expect(mergeBlockers(pr())).toEqual([]);
  });

  it('lists every reason merge is blocked', () => {
    const blocked = pr({
      isDraft: true,
      mergeable: 'CONFLICTING',
      reviewDecision: 'CHANGES_REQUESTED',
      checks: parseCheckRollup(PR_VIEW.statusCheckRollup),
    });
    expect(mergeBlockers(blocked).map((b) => b.kind)).toEqual([
      'draft',
      'conflicts',
      'failing-checks',
      'running-checks',
      'changes-requested',
    ]);
  });

  it('reports a required review', () => {
    expect(mergeBlockers(pr({ reviewDecision: 'REVIEW_REQUIRED' }))[0]?.kind).toBe(
      'review-required',
    );
  });

  it('blocks a closed or merged PR', () => {
    expect(mergeBlockers(pr({ state: 'MERGED' }))[0]?.kind).toBe('not-open');
  });

  it('counts unresolved threads when the branch protection needs them resolved', () => {
    const threads = parseReviewThreads(THREADS);
    expect(
      mergeBlockers(pr({ threads, mergeStateStatus: 'BLOCKED' })).map((b) => b.kind),
    ).toContain('unresolved-threads');
    expect(mergeBlockers(pr({ threads })).map((b) => b.kind)).not.toContain('unresolved-threads');
  });
});

describe('prompts', () => {
  it('asks the agent to address each unresolved thread', () => {
    const prompt = buildReviewFixPrompt(pr(), parseReviewThreads(THREADS));
    expect(prompt).toContain('#42');
    expect(prompt).toContain('src/a.ts:12');
    expect(prompt).toContain('Please handle null here.');
    // Resolved threads are not part of the job.
    expect(prompt).not.toContain('nit');
    // The project style has no em dashes in anything a user or agent reads.
    expect(prompt).not.toContain('—');
  });

  it('builds a read-only local review prompt around the diff', () => {
    const prompt = buildLocalReviewPrompt(pr(), 'diff --git a/x b/x');
    expect(prompt).toContain('Do not edit any files');
    expect(prompt.endsWith('diff --git a/x b/x\n```')).toBe(true);
  });

  it('asks for a title and description in a parseable format', () => {
    const prompt = buildPrTextPrompt('master', ['feat: a', 'fix: b'], ' 2 files changed');
    expect(prompt).toContain('TITLE:');
    expect(prompt).toContain('- feat: a');
    expect(prompt).toContain('2 files changed');
  });

  it('parses the title and description back out', () => {
    expect(parsePrText('TITLE: Add the tab\nBODY:\nIt adds a tab.\n\n- one')).toEqual({
      title: 'Add the tab',
      body: 'It adds a tab.\n\n- one',
    });
    // A model that skipped the format still gives something usable.
    expect(parsePrText('Add the tab\n\nIt adds a tab.')).toEqual({
      title: 'Add the tab',
      body: 'It adds a tab.',
    });
  });
});

describe('review commands', () => {
  it('defaults to the common review bots', () => {
    expect(normalizeReviewCommands(undefined)).toEqual(DEFAULT_REVIEW_COMMANDS);
    expect(DEFAULT_REVIEW_COMMANDS).toContain('@claude review');
  });

  it('keeps a saved list trimmed, deduped and without blanks', () => {
    expect(normalizeReviewCommands([' /gemini review ', '', '/gemini review', 3, '@x go'])).toEqual(
      ['/gemini review', '@x go'],
    );
    // An emptied list is a choice, not a missing value.
    expect(normalizeReviewCommands([])).toEqual([]);
  });
});
