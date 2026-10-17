import {
  CLI_REGISTRY,
  DASHBOARD_CHART_IDS,
  type InstalledCli,
  type ProviderUsage,
  type UsagePeriod,
} from '@agentmat/core';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveConfirm, useConfirmStore } from '@/stores/confirmStore';
import {
  type DashboardItemId,
  statItemId,
  summaryItemId,
  usageItemId,
  useDashboardLayoutStore,
} from '@/stores/dashboardLayoutStore';
import { useTerminalStore } from '@/stores/terminalStore';
import type { SystemStatsSample } from '../../../shared/apiTypes';
import { renderWithProviders } from '../../../test/renderer/renderWithProviders';

/**
 * The dashboard is a user-arranged grid: which cards exist comes from the layout store, what they
 * say comes from the bridge. The tests keep those two apart, seeding a layout and then checking
 * that each card reads its own data, that the empty and unreachable cases say so rather than
 * showing a blank chart, and that edit mode writes the rearrangement back.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

/**
 * The renderer suite already swaps Framer Motion for a stub, but that stub has no
 * `useMotionValueEvent`, which the count-up figures on the usage cards subscribe with, and its
 * motion values have no `jump`. Reduced motion is on in the stub, so nothing animates either way.
 */
vi.mock('framer-motion', async (importOriginal) => {
  const stub = (await importOriginal()) as Record<string, unknown>;
  const motionValue = (initial: number) => {
    let current = initial;
    return {
      get: () => current,
      set: (next: number) => {
        current = next;
      },
      jump: (next: number) => {
        current = next;
      },
      on: () => () => undefined,
    };
  };
  return {
    ...stub,
    useMotionValue: motionValue,
    useSpring: motionValue,
    useTransform: () => motionValue(0),
    useMotionValueEvent: () => undefined,
  };
});

const { default: DashboardPage } = await import('./DashboardPage');

function sample(overrides: Partial<SystemStatsSample> = {}): SystemStatsSample {
  return {
    timestamp: 1_760_000_000_000,
    cpuModel: 'Test CPU 9000',
    cpuCoreCount: 4,
    cpuPercent: 42,
    cpuCorePercents: [11, 22, 33, 44],
    memPercent: 61,
    memUsedBytes: 8 * 1024 ** 3,
    memTotalBytes: 16 * 1024 ** 3,
    disks: [{ id: 'C:', label: 'C:', readBytesPerSec: 1024 * 1024, writeBytesPerSec: 1024 * 1024 }],
    gpus: [
      {
        id: '0',
        label: 'Test GPU',
        percent: 77,
        memUsedBytes: 2 * 1024 ** 3,
        memTotalBytes: 8 * 1024 ** 3,
      },
    ],
    netRxBytesPerSec: 3 * 1024 * 1024,
    netTxBytesPerSec: 512 * 1024,
    pings: [
      { host: '1.1.1.1', alive: true, latencyMs: 12 },
      { host: '8.8.8.8', alive: false, latencyMs: null },
    ],
    ...overrides,
  };
}

function period(total: number, costUsd: number | null = null): UsagePeriod {
  return { tokens: { input: total, output: 0, cacheRead: 0, cacheWrite: 0, total }, costUsd };
}

const claudeUsage: ProviderUsage = {
  providerId: 'claude-code',
  status: 'ok',
  today: period(1_000, 0.5),
  last7d: period(7_000, 3),
  last30d: period(30_000, 12),
  currency: 'USD',
  updatedAt: '2026-04-01T12:00:00.000Z',
};

const installedCli: InstalledCli = {
  id: 'claude-code',
  installed: true,
  version: '1.2.3',
  executablePath: '/usr/local/bin/claude',
  lastCheckedAt: '2026-04-01T10:00:00.000Z',
};

/**
 * Seeds the layout the page draws. Nothing populates it on mount (the app does that at startup),
 * so a test that wants cards has to say which ones.
 */
function seedLayout(
  items: DashboardItemId[],
  extra: Partial<ReturnType<typeof useDashboardLayoutStore.getState>> = {},
): void {
  useDashboardLayoutStore.setState({
    rows: [{ id: 'row-1', columns: 2, items }],
    chartCards: [...DASHBOARD_CHART_IDS],
    ...extra,
  });
}

/** A bridge that always answers the system poll, so the charts have something to draw. */
function withStats(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { 'system.sample': async () => sample(), ...overrides };
}

function renderPage(bridge: Record<string, unknown> = {}) {
  return renderWithProviders(<DashboardPage />, { route: '/', bridge });
}

/** The glass card a title heads, so one card's controls can be told from another's. */
function cardFor(title: string): HTMLElement {
  const card = screen.getByText(title).closest('div.glass');
  if (!card) throw new Error(`No card found around "${title}"`);
  return card as HTMLElement;
}

/** The value a stat tile currently shows, read next to its label. */
function tileValue(label: string): string {
  const tile = screen.getByText(label).parentElement?.parentElement;
  if (!tile) throw new Error(`No tile around "${label}"`);
  return tile.lastElementChild?.textContent ?? '';
}

describe('DashboardPage with an empty layout', () => {
  it('renders its shortcuts and the updates card with nothing else configured', async () => {
    renderPage(withStats());

    expect(screen.getByRole('button', { name: /New Project/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Open Prompt Builder/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Open Workspace/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit layout' })).toBeTruthy();
    // No rows were seeded, so the grid is empty and only the updates card is left.
    expect(screen.queryByText('CPU Usage')).toBeNull();
    expect(
      await screen.findByText(/No AI CLIs or agent tools detected yet/, {}, { timeout: 5_000 }),
    ).toBeTruthy();
  });

  it('keeps going when the CLI scan itself fails', async () => {
    renderPage(withStats({ 'cli.detectAll': () => Promise.reject(new Error('spawn ENOENT')) }));

    expect(
      await screen.findByText(/No AI CLIs or agent tools detected yet/, {}, { timeout: 5_000 }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit layout' })).toBeTruthy();
  });
});

describe('DashboardPage system charts', () => {
  it('draws each chart card from the latest sample', async () => {
    seedLayout(['cpu', 'memory', 'disk', 'gpu', 'network', 'pings']);
    renderPage(withStats());

    const cpu = await waitFor(() => cardFor('CPU Usage'));
    await waitFor(() => expect(within(cpu).getByText('42%')).toBeTruthy());
    expect(within(cpu).getByText('Test CPU 9000 · 4 cores')).toBeTruthy();

    const memory = cardFor('Memory Usage');
    expect(within(memory).getByText('61%')).toBeTruthy();
    expect(within(memory).getByText('8.0 GB / 16.0 GB')).toBeTruthy();

    // One megabyte read plus one written is what the headline adds up. The same figure repeats
    // in the per-drive legend below it, so the assertion aims at the headline row.
    const diskHeadline = within(cardFor('Disk I/O')).getByText('combined read + write')
      .parentElement as HTMLElement;
    expect(within(diskHeadline).getByText('2.0 MB/s')).toBeTruthy();
    expect(within(cardFor('GPU Usage')).getByText('77%')).toBeTruthy();
    expect(within(cardFor('Network Throughput')).getByText('3.0 MB/s')).toBeTruthy();

    const pings = cardFor('Network Status');
    expect(within(pings).getByText('1/2')).toBeTruthy();
    expect(within(pings).getByText('Online')).toBeTruthy();
    expect(within(pings).getByText('Offline')).toBeTruthy();
    // Half the probes came back, which is not a healthy link.
    expect(within(pings).getByText('Poor')).toBeTruthy();

    expect(screen.getAllByRole('img', { name: 'Time series chart' }).length).toBe(6);
  });

  it('breaks the CPU chart out per core on request', async () => {
    seedLayout(['cpu']);
    const { user } = renderPage(withStats());
    const cpu = await waitFor(() => cardFor('CPU Usage'));
    await waitFor(() => expect(within(cpu).getByText('42%')).toBeTruthy());

    await user.click(within(cpu).getByRole('tab', { name: 'Per core' }));

    expect(within(cpu).getByText('11%')).toBeTruthy();
    expect(within(cpu).getByText('44%')).toBeTruthy();
    expect(within(cpu).getByText(/^C0/)).toBeTruthy();

    await user.click(within(cpu).getByRole('tab', { name: 'Total' }));

    expect(within(cpu).queryByText('11%')).toBeNull();
  });

  it('says what a machine does not report rather than drawing an empty chart', async () => {
    seedLayout(['disk', 'gpu', 'pings']);
    renderPage(
      withStats({ 'system.sample': async () => sample({ disks: [], gpus: [], pings: [] }) }),
    );

    expect(await screen.findByText('No disk activity detected.')).toBeTruthy();
    expect(screen.getByText('No supported GPU detected.')).toBeTruthy();
    expect(screen.getByText(/No ping targets configured/)).toBeTruthy();
    // The GPU headline has no number to show either, instead of reading 0%.
    expect(within(cardFor('GPU Usage')).getByText('N/A')).toBeTruthy();
  });

  it('offers a terminal to investigate a ping target', async () => {
    seedLayout(['pings']);
    const { user } = renderPage(withStats());
    await waitFor(() => expect(screen.getByRole('button', { name: '1.1.1.1' })).toBeTruthy());

    await user.click(screen.getByRole('button', { name: '1.1.1.1' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Traceroute/ }));

    const session = useTerminalStore
      .getState()
      .sessions.find((one) => one.title === 'Traceroute 1.1.1.1');
    expect(session?.initialInput).toBe('tracert -d 1.1.1.1');
    expect(toast.info).toHaveBeenCalledWith(
      'Press Enter in the terminal to trace the route to 1.1.1.1.',
    );
  });

  it('names an HTTP probe target by its site, without ping or traceroute', async () => {
    seedLayout(['pings']);
    const url = 'https://www.gstatic.com/generate_204';
    const { user } = renderPage(
      withStats({
        'system.sample': async () => sample({ pings: [{ host: url, alive: true, latencyMs: 30 }] }),
      }),
    );

    const name = await waitFor(() => within(cardFor('Network Status')).getByText('gstatic'));
    expect(screen.queryByRole('button', { name: 'gstatic' })).toBeNull();
    expect(screen.queryByText(url)).toBeNull();

    // The full URL is still there on hover.
    await user.hover(name);
    expect((await screen.findAllByText(url)).length).toBeGreaterThan(0);
  });
});

describe('DashboardPage stat tiles', () => {
  it('counts what the bridge reports for each tile', async () => {
    seedLayout(
      [statItemId('installed-clis'), statItemId('active-projects'), statItemId('skill-repos')],
      { statCards: ['installed-clis', 'active-projects', 'skill-repos'] },
    );
    renderPage(
      withStats({
        'cli.detectAll': [installedCli],
        'projects.list': [
          { id: 'p1', name: 'One', folderPath: '/one', archived: false },
          { id: 'p2', name: 'Two', folderPath: '/two', archived: false },
          { id: 'p3', name: 'Old', folderPath: '/old', archived: true },
        ],
        'skills.listRepositories': [{ id: 'r1', name: 'Community' }],
      }),
    );

    await waitFor(() => expect(tileValue('Installed CLIs')).toBe(`1/${CLI_REGISTRY.length}`));
    // The archived project is not an active one.
    expect(tileValue('Active Projects')).toBe('2');
    expect(tileValue('Skill Repositories')).toBe('1');
  });

  it('shows the looked-up address and copies it on click', async () => {
    seedLayout([statItemId('location')], { statCards: ['location'] });
    renderPage(
      withStats({ 'ipGeo.lookup': { ip: '203.0.113.9', country: 'Germany', countryCode: 'DE' } }),
    );

    const ip = await screen.findByRole('button', { name: '203.0.113.9' }, { timeout: 5_000 });
    fireEvent.click(ip);

    // Read back rather than asserting on the spy: setting userEvent up swaps navigator.clipboard
    // for its own stub, so what matters is that the address really landed on the clipboard.
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe('203.0.113.9'));
    expect(toast.success).toHaveBeenCalledWith('IP address copied.');
  });

  it('asks for a fresh lookup, skipping the cache, when the tile is refreshed', async () => {
    seedLayout([statItemId('location')], { statCards: ['location'] });
    const { user, bridge } = renderPage(
      withStats({ 'ipGeo.lookup': { ip: '203.0.113.9', country: 'Germany', countryCode: 'DE' } }),
    );
    await screen.findByRole('button', { name: '203.0.113.9' }, { timeout: 5_000 });
    expect(bridge.$fn('ipGeo.lookup')).toHaveBeenCalledWith(false);

    const tile = screen.getByText('Your Location').parentElement as HTMLElement;
    await user.click(within(tile).getByRole('button'));

    await waitFor(() => expect(bridge.$fn('ipGeo.lookup')).toHaveBeenCalledWith(true));
  });

  it('says the location is unavailable when the lookup fails', async () => {
    seedLayout([statItemId('location')], { statCards: ['location'] });
    renderPage(withStats({ 'ipGeo.lookup': () => Promise.reject(new Error('offline')) }));

    expect(await screen.findByText('Unavailable', {}, { timeout: 5_000 })).toBeTruthy();
  });
});

describe('DashboardPage token usage cards', () => {
  it('shows the pinned summary tiles from the same totals the Usage page uses', async () => {
    seedLayout([summaryItemId('tokens-today'), summaryItemId('cost-today')], {
      summaryCards: ['tokens-today', 'cost-today'],
    });
    renderPage(withStats({ 'settings.get': {}, 'usage.list': [claudeUsage] }));

    await waitFor(() => expect(tileValue('Tokens today')).toBe('1.0K'));
    expect(tileValue('Cost today')).toBe('$0.50');
  });

  it('draws a pinned provider card, and says so when it is no longer tracked', async () => {
    seedLayout([usageItemId('claude-code')], { usageCards: ['claude-code'] });
    const { unmount } = renderPage(withStats({ 'settings.get': {}, 'usage.list': [claudeUsage] }));

    expect(await screen.findByText('Claude Code')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('tokens today')).toBeTruthy());
    unmount();

    seedLayout([usageItemId('claude-code')], { usageCards: ['claude-code'] });
    renderPage(withStats({ 'settings.get': {}, 'usage.list': [] }));

    expect(await screen.findByText('No longer tracked on the Token Usage page.')).toBeTruthy();
  });
});

describe('DashboardPage editing the layout', () => {
  it('reveals the layout controls and hides them again', async () => {
    seedLayout(['cpu']);
    const { user } = renderPage(withStats());

    await user.click(screen.getByRole('button', { name: 'Edit layout' }));

    expect(screen.getByRole('button', { name: /Add card/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add row/ })).toBeTruthy();
    expect(screen.getByText('Drop a card here')).toBeTruthy();
    expect(screen.getByText('1 card')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Done editing' }));

    expect(screen.queryByRole('button', { name: /Add card/ })).toBeNull();
    expect(screen.queryByText('Drop a card here')).toBeNull();
  });

  it('saves the column count a row is set to', async () => {
    seedLayout(['cpu', 'memory']);
    const { user, bridge } = renderPage(withStats());
    await user.click(screen.getByRole('button', { name: 'Edit layout' }));

    await user.click(screen.getByRole('button', { name: '3', pressed: false }));

    expect(useDashboardLayoutStore.getState().rows[0].columns).toBe(3);
    await waitFor(() =>
      expect(bridge.$fn('settings.update')).toHaveBeenCalledWith(
        expect.objectContaining({
          dashboardLayout: [{ id: 'row-1', columns: 3, items: ['cpu', 'memory'] }],
        }),
      ),
    );
  });

  it('adds a row for cards to be dropped into', async () => {
    seedLayout(['cpu']);
    const { user } = renderPage(withStats());
    await user.click(screen.getByRole('button', { name: 'Edit layout' }));

    await user.click(screen.getByRole('button', { name: /Add row/ }));

    expect(useDashboardLayoutStore.getState().rows).toHaveLength(2);
    expect(screen.getByText('Empty row')).toBeTruthy();
  });

  it('hides a card from the dashboard and brings it back from the Add card menu', async () => {
    seedLayout(['cpu', 'memory']);
    const { user } = renderPage(withStats());
    await user.click(screen.getByRole('button', { name: 'Edit layout' }));
    const cpu = cardFor('CPU Usage');

    // [top apps, remove]: the drag handle is a span, not a button.
    const buttons = within(cpu).getAllByRole('button');
    await user.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(screen.queryByText('CPU Usage')).toBeNull());
    expect(useDashboardLayoutStore.getState().chartCards).not.toContain('cpu');
    expect(toast.info).toHaveBeenCalledWith('CPU Usage removed from the dashboard.');

    await user.click(screen.getByRole('button', { name: /Add card/ }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'CPU Usage' }));

    await waitFor(() => expect(useDashboardLayoutStore.getState().chartCards).toContain('cpu'));
    expect(screen.getByText('CPU Usage')).toBeTruthy();
  });

  it('brings back the Docker and emulator cards from the Add card menu', async () => {
    const without = DASHBOARD_CHART_IDS.filter(
      (id) => id !== 'resource-usage' && id !== 'idle-resources',
    );
    seedLayout(['cpu'], { chartCards: without });
    const { user } = renderPage(withStats());
    await user.click(screen.getByRole('button', { name: 'Edit layout' }));
    expect(screen.queryByText('Idle Docker and Emulators')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Add card/ }));
    await user.click(
      await screen.findByRole('menuitemcheckbox', { name: 'Idle Docker and Emulators' }),
    );
    await waitFor(() =>
      expect(useDashboardLayoutStore.getState().chartCards).toContain('idle-resources'),
    );
    expect(screen.getByText('Idle Docker and Emulators')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Add card/ }));
    await user.click(
      await screen.findByRole('menuitemcheckbox', { name: 'Docker and Emulator Usage' }),
    );
    await waitFor(() =>
      expect(useDashboardLayoutStore.getState().chartCards).toContain('resource-usage'),
    );
    expect(screen.getByText('Docker and Emulator Usage')).toBeTruthy();
  });

  it('pins a Token Usage summary tile from the Add card menu', async () => {
    seedLayout(['cpu']);
    const { user } = renderPage(withStats({ 'settings.get': {}, 'usage.list': [claudeUsage] }));
    await user.click(screen.getByRole('button', { name: 'Edit layout' }));

    await user.click(screen.getByRole('button', { name: /Add card/ }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Tokens today' }));

    await waitFor(() =>
      expect(useDashboardLayoutStore.getState().summaryCards).toContain('tokens-today'),
    );
    await waitFor(() => expect(tileValue('Tokens today')).toBe('1.0K'));
  });

  it('resets the layout to the new-install default once confirmed', async () => {
    seedLayout(['cpu'], { statCards: [], usageCards: [], summaryCards: [] });
    const { user, bridge } = renderPage(withStats());
    await user.click(screen.getByRole('button', { name: 'Edit layout' }));

    await user.click(screen.getByRole('button', { name: /Reset to default/ }));
    await waitFor(() => expect(useConfirmStore.getState().open).toBe(true));
    // Nothing changes until the user says yes.
    expect(useDashboardLayoutStore.getState().rows[0].items).toEqual(['cpu']);
    resolveConfirm(true);

    await waitFor(() =>
      expect(useDashboardLayoutStore.getState().rows.map((row) => row.columns)).toEqual([
        4, 2, 3, 2, 2,
      ]),
    );
    const state = useDashboardLayoutStore.getState();
    expect(state.rows[0].items).toEqual([
      summaryItemId('tokens-today'),
      summaryItemId('tokens-week'),
      summaryItemId('cost-today'),
      statItemId('location'),
    ]);
    expect(state.usageCards).toEqual(['claude-code']);
    expect(bridge.$fn('settings.update')).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardStatCards: ['location'],
        dashboardUsageSummaryCards: ['tokens-today', 'tokens-week', 'cost-today'],
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Dashboard reset to default.');
  });
});

describe('DashboardPage updates card', () => {
  it('reports that everything installed is current', async () => {
    renderPage(
      withStats({
        'cli.detectAll': [installedCli],
        'tools.detectAll': [],
        'cli.checkForUpdate': async () => ({
          cliId: 'claude-code',
          supported: true,
          currentVersion: '1.2.3',
          latestVersion: '1.2.3',
          updateAvailable: false,
        }),
      }),
    );

    expect(
      await screen.findByText(
        'All 1 installed CLI and agent tool is up to date.',
        {},
        {
          timeout: 5_000,
        },
      ),
    ).toBeTruthy();
  });

  it('offers the update command in a terminal when a newer version is out', async () => {
    const { user } = renderPage(
      withStats({
        'cli.detectAll': [installedCli],
        'tools.detectAll': [],
        'cli.checkForUpdate': async () => ({
          cliId: 'claude-code',
          supported: true,
          currentVersion: '1.2.3',
          latestVersion: '2.0.0',
          updateAvailable: true,
        }),
        'cli.getUpdateCommand': async () => 'claude update',
        'cli.checkCommandPrerequisite': async () => null,
      }),
    );

    expect(await screen.findByText('1 update', {}, { timeout: 5_000 })).toBeTruthy();
    expect(screen.getByText('v2.0.0')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Update/ }));

    // Nothing is run for the user: the command is typed into a session they still accept.
    await waitFor(() => {
      const session = useTerminalStore
        .getState()
        .sessions.find((one) => one.title === 'Update Claude Code CLI');
      expect(session?.initialInput).toBe('claude update');
    });
    expect(toast.info).toHaveBeenCalledWith(
      'Press Enter in the terminal to update Claude Code CLI.',
    );
  });

  it('says what is missing instead of opening an update terminal that would fail', async () => {
    const { user } = renderPage(
      withStats({
        'cli.detectAll': [installedCli],
        'tools.detectAll': [],
        'cli.checkForUpdate': async () => ({
          cliId: 'claude-code',
          supported: true,
          currentVersion: '1.2.3',
          latestVersion: '2.0.0',
          updateAvailable: true,
        }),
        // A copy installed with npm updates with npm, which this machine no longer has.
        'cli.getUpdateCommand': async () => 'npm install -g @anthropic-ai/claude-code@latest',
        'cli.checkCommandPrerequisite': { name: 'Node.js', url: 'https://nodejs.org/en/download' },
      }),
    );

    expect(await screen.findByText('1 update', {}, { timeout: 5_000 })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Update/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Claude Code CLI needs Node.js, which isn't installed.",
        expect.anything(),
      ),
    );
    expect(useTerminalStore.getState().sessions).toHaveLength(0);
    expect(toast.info).not.toHaveBeenCalledWith(
      'Press Enter in the terminal to update Claude Code CLI.',
    );
  });
});

describe('DashboardPage Docker and emulator cards', () => {
  const MIN = 60_000;
  const IDLE_SETTINGS = { idleResourceMinutes: 20, idleResourceNotify: true };
  const idleSnapshot = {
    generatedAt: 10_000_000,
    watchingSince: 0,
    idleMinutes: 20,
    docker: 'ready',
    emulators: 'ready',
    resources: [
      {
        key: 'docker:a',
        kind: 'docker',
        id: 'a',
        name: 'postgres',
        detail: 'postgres:16',
        cpuPercent: 0.2,
        memBytes: 50 * 1024 ** 2,
        measurable: true,
        firstSeenAt: 0,
        lastActiveAt: 0,
        idleForMs: 33 * MIN,
        idle: true,
      },
    ],
    history: [
      {
        at: 1_000,
        dockerCpu: 1,
        dockerMem: 50 * 1024 ** 2,
        dockerCount: 1,
        emulatorCpu: 0,
        emulatorMem: 0,
        emulatorCount: 0,
      },
      {
        at: 2_000,
        dockerCpu: 2,
        dockerMem: 50 * 1024 ** 2,
        dockerCount: 1,
        emulatorCpu: 0,
        emulatorMem: 0,
        emulatorCount: 0,
      },
    ],
  };

  it('draws the usage chart and the idle list from what the main process tracked', async () => {
    seedLayout(['resource-usage', 'idle-resources']);
    renderPage(
      withStats({
        'resourceActivity.snapshot': async () => idleSnapshot,
        'settings.get': IDLE_SETTINGS,
      }),
    );

    const usage = await waitFor(() => cardFor('Docker and Emulator Usage'));
    await waitFor(() => expect(within(usage).getByText('2.0%')).toBeTruthy());
    expect(within(usage).getByText('1 container')).toBeTruthy();

    const idle = cardFor('Idle Docker and Emulators');
    expect(await within(idle).findByText('postgres')).toBeTruthy();
    expect(within(idle).getByText('idle 33 min')).toBeTruthy();
    expect(within(idle).getByText('idle of 1 running')).toBeTruthy();
  });

  it('removes each card in edit mode and says so', async () => {
    seedLayout(['resource-usage', 'idle-resources']);
    const { user } = renderPage(
      withStats({
        'resourceActivity.snapshot': async () => idleSnapshot,
        'settings.get': IDLE_SETTINGS,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Edit layout' }));

    await user.click(
      within(cardFor('Idle Docker and Emulators')).getByRole('button', {
        name: 'Remove from dashboard',
      }),
    );

    await waitFor(() => expect(screen.queryByText('Idle Docker and Emulators')).toBeNull());
    expect(useDashboardLayoutStore.getState().chartCards).not.toContain('idle-resources');
    expect(toast.info).toHaveBeenCalledWith(
      'Idle Docker and Emulators removed from the dashboard.',
    );
    expect(screen.getByText('Docker and Emulator Usage')).toBeTruthy();
  });
});
