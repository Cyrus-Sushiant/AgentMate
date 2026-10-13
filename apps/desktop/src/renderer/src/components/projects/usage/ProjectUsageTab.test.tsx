// @vitest-environment jsdom
import type { ProjectUsageReport } from '@shared/apiTypes';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { ProjectUsageTab } from './ProjectUsageTab';

/**
 * The Usage tab of a project: what every agent conversation in it has used, and the list price
 * estimate of that. The main process does the reading; these tests give the tab a finished report
 * and check what it makes of it, including every way the numbers can be incomplete.
 */

type Ok = Extract<ProjectUsageReport, { status: 'ok' }>;

const tokens = (total: number, split = { input: 0.6, output: 0.1, cacheRead: 0.3 }) => ({
  input: Math.round(total * split.input),
  output: Math.round(total * split.output),
  cacheRead: Math.round(total * split.cacheRead),
  cacheWrite: 0,
  total,
});

function report(overrides: Partial<Ok> = {}): Ok {
  return {
    status: 'ok',
    days: null,
    tokens: {
      input: 30_000_000,
      output: 2_000_000,
      cacheRead: 16_000_000,
      cacheWrite: 213_990,
      total: 48_213_990,
    },
    costUsd: 128.4,
    costPartial: false,
    conversations: 37,
    byDay: [
      { day: '2026-09-17', tokens: 20_000_000, costUsd: 60.5 },
      { day: '2026-09-18', tokens: 5_000_000, costUsd: 12.25 },
      { day: '2026-09-19', tokens: 23_213_990, costUsd: 55.65 },
    ],
    byAgent: [
      {
        provider: 'claude-code',
        conversations: 30,
        tokens: tokens(40_000_000),
        costUsd: 120.1,
        costPartial: false,
      },
      {
        provider: 'codex',
        conversations: 7,
        tokens: tokens(8_213_990),
        costUsd: 8.3,
        costPartial: false,
      },
    ],
    byModel: [
      { model: 'claude-opus-5-5', tokens: tokens(38_000_000), costUsd: 110.75 },
      { model: 'some-custom-model', tokens: tokens(2_000_000), costUsd: null },
    ],
    top: [
      {
        provider: 'claude-code',
        id: 'a',
        title: 'Refactor billing',
        updatedAt: new Date(2026, 8, 19).getTime(),
        tokens: 12_000_000,
        costUsd: 41.2,
        costPartial: false,
      },
      {
        provider: 'codex',
        id: 'b',
        title: null,
        updatedAt: new Date(2026, 8, 18).getTime(),
        tokens: 900_000,
        costUsd: null,
        costPartial: false,
      },
    ],
    uncounted: [],
    unreadable: 0,
    truncated: false,
    folders: 1,
    ...overrides,
  };
}

/** A project nothing has run in. */
const empty = (): Ok =>
  report({
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    costUsd: null,
    conversations: 0,
    byDay: [],
    byAgent: [],
    byModel: [],
    top: [],
  });

function renderTab(answer: unknown = report()) {
  const bridge = { 'agents.projectUsage': typeof answer === 'function' ? answer : () => answer };
  return renderWithProviders(<ProjectUsageTab projectId="p1" />, { bridge });
}

const asked = (view: ReturnType<typeof renderTab>) => view.bridge.$fn('agents.projectUsage');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 20, 15));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ProjectUsageTab loading and failure', () => {
  it('shimmers in place of the numbers while the report is read', () => {
    renderTab(() => new Promise(() => undefined));

    expect(screen.getByRole('status', { name: 'Loading usage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Usage and cost' })).toBeInTheDocument();
  });

  it('says so, and offers another try, when reading failed', async () => {
    const answers = [Promise.reject(new Error('timed out')), Promise.resolve(report())];
    const view = renderTab(() => answers.shift());

    expect(await screen.findByRole('alert')).toHaveTextContent('Usage could not be read');
    await view.user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('$128.40')).toBeInTheDocument();
    expect(asked(view)).toHaveBeenCalledTimes(2);
  });

  it('says the project was not found when the main process has no such project', async () => {
    renderTab({ status: 'unavailable' });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This project's conversations could not be found",
    );
  });
});

describe('ProjectUsageTab period', () => {
  it('starts with everything, as the user asked', async () => {
    const view = renderTab();

    await screen.findByText('$128.40');
    expect(asked(view)).toHaveBeenCalledWith('p1', null);
    expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('reads the last 30 or 7 days when asked, and shows that period instead', async () => {
    const view = renderTab((_id: string, days: number | null) =>
      Promise.resolve(
        days === 30
          ? report({ days: 30, costUsd: 9.99 })
          : days === 7
            ? report({ days: 7, costUsd: 1.5 })
            : report(),
      ),
    );
    await screen.findByText('$128.40');

    await view.user.click(screen.getByRole('button', { name: '30 days' }));
    expect(await screen.findByText('$9.99')).toBeInTheDocument();
    expect(asked(view)).toHaveBeenLastCalledWith('p1', 30);

    await view.user.click(screen.getByRole('button', { name: '7 days' }));
    expect(await screen.findByText('$1.50')).toBeInTheDocument();
    expect(asked(view)).toHaveBeenLastCalledWith('p1', 7);
    expect(screen.queryByText('$9.99')).not.toBeInTheDocument();
  });

  it('reads again on refresh', async () => {
    const view = renderTab();
    await screen.findByText('$128.40');

    await view.user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(asked(view)).toHaveBeenCalledTimes(2));
  });
});

describe('ProjectUsageTab headline', () => {
  it('shows the cost, the tokens with their exact count, and the conversations', async () => {
    renderTab();

    expect(await screen.findByText('$128.40')).toBeInTheDocument();
    expect(screen.getByText('48.21M')).toBeInTheDocument();
    expect(screen.getByText('48,213,990')).toBeInTheDocument();
    expect(screen.getByText('37')).toBeInTheDocument();
    expect(screen.getByText('across 2 agents')).toBeInTheDocument();
  });

  it('groups the thousands of a big total', async () => {
    renderTab(
      report({
        costUsd: 3336.031,
        byAgent: [
          {
            provider: 'claude-code',
            conversations: 30,
            tokens: tokens(40_000_000),
            costUsd: 3336.031,
            costPartial: false,
          },
        ],
      }),
    );

    // Once in the headline, once on the agent that spent it.
    expect(await screen.findAllByText('$3,336.03')).toHaveLength(2);
    expect(screen.queryByText('$3336.03')).not.toBeInTheDocument();
  });

  it('marks a cost that is only part of the tokens as a minimum', async () => {
    renderTab(report({ costPartial: true }));

    expect(await screen.findByText('$128.40+')).toBeInTheDocument();
    expect(
      screen.getByText(/Some models have no known price, so the cost is a minimum/),
    ).toBeInTheDocument();
  });

  it('calls a cost nobody can work out unpriced, not free', async () => {
    renderTab(
      report({
        costUsd: null,
        byDay: [{ day: '2026-09-19', tokens: 5, costUsd: null }],
        byAgent: [],
        byModel: [],
        top: [],
      }),
    );

    expect(await screen.findByText('Unpriced')).toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('is plain about a project nothing has run in', async () => {
    renderTab(empty());

    expect(await screen.findByText('No usage yet')).toBeInTheDocument();
    expect(screen.queryByText('By agent')).not.toBeInTheDocument();
  });

  it('suggests a longer period when a short one is empty', async () => {
    const view = renderTab(empty());
    await screen.findByText('No usage yet');

    await view.user.click(screen.getByRole('button', { name: '7 days' }));

    expect(await screen.findByText(/Try a longer period/)).toBeInTheDocument();
  });
});

describe('ProjectUsageTab breakdowns', () => {
  it('lists each agent with its cost and tokens', async () => {
    renderTab();
    await screen.findByText('$128.40');

    const claude = screen.getByText('Claude').closest('li');
    expect(claude).toHaveTextContent('$120.10');
    expect(claude).toHaveTextContent('40.00M');
    expect(screen.getByText('Codex').closest('li')).toHaveTextContent('$8.30');
  });

  it('names models the way the rest of the app does, and flags one with no price', async () => {
    renderTab();
    await screen.findByText('$128.40');

    expect(screen.getByText('Opus 5.5').closest('li')).toHaveTextContent('$110.75');
    expect(screen.getByText('Some Custom Model').closest('li')).toHaveTextContent('Unpriced');
  });

  it('fills the bar of the only row, even when it cost less than a dollar', async () => {
    renderTab(
      report({
        byAgent: [
          {
            provider: 'claude-code',
            conversations: 1,
            tokens: tokens(1_000_000),
            costUsd: 0.86,
            costPartial: false,
          },
        ],
      }),
    );
    await screen.findByText('$128.40');

    const row = screen.getByText('Claude').closest('li') as HTMLElement;
    expect(within(row).getByTestId('bar-fill')).toHaveStyle({ width: '100%' });
  });

  it('sizes each bar against the biggest row', async () => {
    renderTab(
      report({
        byAgent: [
          {
            provider: 'claude-code',
            conversations: 1,
            tokens: tokens(2_000_000),
            costUsd: 0.5,
            costPartial: false,
          },
          {
            provider: 'codex',
            conversations: 1,
            tokens: tokens(9_000_000),
            costUsd: 0.125,
            costPartial: false,
          },
        ],
      }),
    );
    await screen.findByText('$128.40');

    const width = (label: string): string =>
      within(screen.getByText(label).closest('li') as HTMLElement).getByTestId('bar-fill').style
        .width;
    // By cost, not by tokens: Codex used more tokens but spent less.
    expect(width('Claude')).toBe('100%');
    expect(width('Codex')).toBe('25%');
  });

  it('draws the split between input, output and cache', async () => {
    renderTab();

    expect(await screen.findByRole('img', { name: /Token split: Input 62%/ })).toBeInTheDocument();
  });

  it('ranks the costliest conversations, unnamed ones included', async () => {
    renderTab();
    await screen.findByText('$128.40');

    const list = screen.getByRole('list', { name: 'Most expensive conversations' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Refactor billing');
    expect(rows[0]).toHaveTextContent('$41.20');
    expect(rows[0]).toHaveTextContent('12.00M');
    expect(rows[1]).toHaveTextContent('Untitled conversation');
    expect(rows[1]).toHaveTextContent('Unpriced');
  });
});

describe('ProjectUsageTab chart', () => {
  it('has a bar for every day of the period, the quiet ones too', async () => {
    renderTab();
    await screen.findByText('$128.40');

    const bars = within(screen.getByRole('list', { name: 'Spend per day' })).getAllByRole(
      'listitem',
    );
    // From the first day with spend (Sep 17) to today (Sep 20).
    expect(bars).toHaveLength(4);
    expect(bars[0]).toHaveAccessibleName('Sep 17: $60.50, 20.00M tokens');
    expect(bars[3]).toHaveAccessibleName('Sep 20: no usage');
  });

  it('points out the day that cost the most', async () => {
    renderTab();

    expect(await screen.findByText('Peak $60.50 on Sep 17')).toBeInTheDocument();
  });

  it('switches to tokens on request', async () => {
    const view = renderTab();
    await screen.findByText('$128.40');

    await view.user.click(screen.getByRole('button', { name: 'Tokens' }));

    expect(screen.getByRole('list', { name: 'Tokens per day' })).toBeInTheDocument();
    expect(screen.getByText('Peak 23.21M on Sep 19')).toBeInTheDocument();
  });

  it('only offers tokens when no day has a cost', async () => {
    renderTab(
      report({
        costUsd: null,
        byDay: [{ day: '2026-09-19', tokens: 5_000, costUsd: null }],
      }),
    );

    expect(await screen.findByRole('list', { name: 'Tokens per day' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cost' })).not.toBeInTheDocument();
  });

  it('shows a day on hover', async () => {
    const view = renderTab();
    await screen.findByText('$128.40');

    const first = within(screen.getByRole('list', { name: 'Spend per day' })).getAllByRole(
      'listitem',
    )[0];
    await view.user.hover(first);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Sep 17');
  });
});

describe('ProjectUsageTab footnotes', () => {
  it('always says the cost is an estimate, not a bill', async () => {
    renderTab();

    expect(await screen.findByText(/list prices/)).toBeInTheDocument();
  });

  it('names the agents whose conversations could not be counted', async () => {
    renderTab(
      report({
        uncounted: [
          { provider: 'gemini-cli', conversations: 3 },
          { provider: 'cursor-cli', conversations: 1 },
        ],
      }),
    );

    expect(
      await screen.findByText(/3 Gemini and 1 Cursor conversations are not counted/),
    ).toBeInTheDocument();
  });

  it('says how many conversations could not be read', async () => {
    renderTab(report({ unreadable: 2 }));

    expect(await screen.findByText(/2 conversations could not be read/)).toBeInTheDocument();
  });

  it('says when only the newest conversations were read', async () => {
    renderTab(report({ truncated: true }));

    expect(await screen.findByText(/Only the newest conversations were read/)).toBeInTheDocument();
  });

  it('says worktrees are included', async () => {
    renderTab(report({ folders: 3 }));

    expect(
      await screen.findByText(/the project folder and its 2 git worktrees/),
    ).toBeInTheDocument();
  });

  it('explains how OpenCode is dated', async () => {
    renderTab(
      report({
        byAgent: [
          {
            provider: 'opencode',
            conversations: 2,
            tokens: tokens(1_000_000),
            costUsd: 2,
            costPartial: false,
          },
        ],
      }),
    );

    expect(
      await screen.findByText(/OpenCode keeps one total per conversation/),
    ).toBeInTheDocument();
  });
});
