import type { AndroidSdkStatus } from '@agentmat/core';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRunSessionStore } from '@/stores/runSessionStore';
import { type TerminalSessionMeta, useTerminalStore } from '@/stores/terminalStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useNavigate: () => navigate };
});

const { StatusBar } = await import('./StatusBar');

/**
 * The Android entry in the bottom bar. It is the quick way to see what is running without
 * leaving whatever page you are on, so what matters is that it stays out of the way when there
 * is no SDK, shows real usage rather than a bare count, and every row is a way through to the
 * device it names.
 */

const FULL_SDK: AndroidSdkStatus = {
  status: 'found',
  root: '/home/dev/Android/Sdk',
  source: 'ANDROID_HOME',
  checked: ['/home/dev/Android/Sdk'],
  tools: { adb: true, emulator: true, avdmanager: true, sdkmanager: true },
  adbVersion: '35.0.1',
};

const NO_SDK: AndroidSdkStatus = {
  ...FULL_SDK,
  status: 'missing',
  root: null,
  source: null,
  adbVersion: null,
  tools: { adb: false, emulator: false, avdmanager: false, sdkmanager: false },
};

function emulator(name: string, serial: string | null, over: Record<string, unknown> = {}) {
  return {
    kind: 'emulator',
    avd: {
      name,
      displayName: name.replace(/_/g, ' '),
      device: 'pixel_7',
      manufacturer: 'Google',
      api: 34,
      tag: 'google_apis',
      abi: 'x86_64',
      playStore: false,
      ramMb: 2048,
      storageMb: 6144,
      gpuMode: 'auto',
      systemImageDir: null,
      path: null,
    },
    state: serial ? 'running' : 'stopped',
    serial,
    progress: serial ? 100 : 0,
    adopted: false,
    usage: null,
    lastLine: null,
    error: null,
    ...over,
  };
}

function snapshot(emulators: unknown[], physical: unknown[] = []) {
  return { sdk: FULL_SDK, emulators, physical, broken: [] };
}

function setup(bridge: Record<string, unknown>) {
  navigate.mockClear();
  return renderWithProviders(<StatusBar />, { bridge });
}

describe('the Android status bar entry', () => {
  it('stays out of the bar when there is no SDK on this machine', async () => {
    setup({ 'android.sdk': NO_SDK });

    // Nothing to show and nowhere useful to go, so the bar says nothing about Android.
    await waitFor(() => expect(screen.queryByLabelText(/^Android:/)).not.toBeInTheDocument());
  });

  it('counts the emulators that are actually up', async () => {
    setup({
      'android.sdk': FULL_SDK,
      'android.refresh': snapshot([
        emulator('Pixel_7_API_34', 'emulator-5554'),
        emulator('Pixel_Tablet', null),
      ]),
    });

    expect(await screen.findByText('1 running')).toBeInTheDocument();
  });

  it('opens a list of what is running, with the usage of each', async () => {
    const { user } = setup({
      'android.sdk': FULL_SDK,
      'android.refresh': snapshot([
        emulator('Pixel_7_API_34', 'emulator-5554', {
          usage: { cpuPercent: 23, memoryBytes: 2_147_483_648, cpuReady: true },
        }),
      ]),
    });

    await user.click(await screen.findByLabelText(/^Android:/));

    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText('Pixel 7 API 34')).toBeInTheDocument();
    expect(within(panel).getByText('23%')).toBeInTheDocument();
    expect(within(panel).getByText('2.0 GB')).toBeInTheDocument();
  });

  it('says it is measuring before the first CPU sample has a rate', async () => {
    const { user } = setup({
      'android.sdk': FULL_SDK,
      'android.refresh': snapshot([
        emulator('Pixel_7_API_34', 'emulator-5554', {
          usage: { cpuPercent: 0, memoryBytes: 1_073_741_824, cpuReady: false },
        }),
      ]),
    });

    await user.click(await screen.findByLabelText(/^Android:/));

    const panel = await screen.findByRole('dialog');
    expect(within(panel).queryByText('0%')).not.toBeInTheDocument();
    expect(within(panel).getByText(/measuring/i)).toBeInTheDocument();
  });

  it('takes you to the device you clicked', async () => {
    const { user } = setup({
      'android.sdk': FULL_SDK,
      'android.refresh': snapshot([emulator('Pixel_7_API_34', 'emulator-5554')]),
    });

    await user.click(await screen.findByLabelText(/^Android:/));
    const panel = await screen.findByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: /Pixel 7 API 34/ }));

    expect(navigate).toHaveBeenCalledWith('/android?device=emulator-5554');
  });

  it('offers a way to the page when nothing is running', async () => {
    const { user } = setup({
      'android.sdk': FULL_SDK,
      'android.refresh': snapshot([emulator('Pixel_7_API_34', null)]),
    });

    await user.click(await screen.findByLabelText(/^Android:/));
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText(/No emulators running/i)).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: /Open the Android page/i }));
    expect(navigate).toHaveBeenCalledWith('/android');
  });

  it('samples usage only while the panel is open', async () => {
    const { user, bridge } = setup({
      'android.sdk': FULL_SDK,
      'android.refresh': snapshot([emulator('Pixel_7_API_34', 'emulator-5554')]),
    });
    const watchUsage = window.agentmat.android.watchUsage;

    await screen.findByText('1 running');
    // The bar is always on screen, so it must not keep a process sampler running behind it.
    expect(watchUsage).not.toHaveBeenCalledWith(true);

    await user.click(screen.getByLabelText(/^Android:/));
    await waitFor(() => expect(bridge.$fn('android.watchUsage')).toHaveBeenCalledWith(true));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(bridge.$fn('android.watchUsage')).toHaveBeenCalledWith(false));
  });
});

/**
 * The project runs entry: every terminal started with Run, what it is using and where it can be
 * reached, with a way to stop it. It sits in a 24px bar next to the agents, so one run shows its
 * detail and several collapse into a count.
 */
describe('the project runs entry', () => {
  const MB = 1024 * 1024;

  function runInfo(label: string, command: string, kind: 'web' | 'mobile' = 'web') {
    return {
      commandId: label.toLowerCase(),
      label,
      command,
      kind,
      startedAt: Date.now() - 120_000,
    };
  }

  function status(sessionId: string, over: Record<string, unknown> = {}) {
    return {
      sessionId,
      alive: true,
      cpuPercent: 4,
      memBytes: 200 * MB,
      processCount: 3,
      ports: [],
      ...over,
    };
  }

  function runs(
    sessions: TerminalSessionMeta[],
    outputs: Record<string, { urls: string[]; devices: string[] }> = {},
  ): void {
    useTerminalStore.setState({ sessions, activeSessionId: null, isOpen: false });
    useRunSessionStore.setState({ outputs });
  }

  const DEV: TerminalSessionMeta = {
    id: 'dev',
    title: 'Apollo',
    projectId: 'apollo',
    run: runInfo('Dev', 'pnpm dev'),
  };

  function setupRuns(statuses: unknown[], extra: Record<string, unknown> = {}) {
    navigate.mockClear();
    return renderWithProviders(<StatusBar />, {
      bridge: {
        'android.sdk': NO_SDK,
        'terminal.runStatus': { available: true, cpuReady: true, sessions: statuses },
        ...extra,
      },
    });
  }

  it('shows one run with its port, CPU and memory', async () => {
    runs([DEV], { dev: { urls: ['http://localhost:5173/'], devices: [] } });
    setupRuns([status('dev', { ports: [5173] })]);

    const chip = await screen.findByRole('button', { name: 'Apollo: Dev' });
    await waitFor(() => expect(within(chip).getByText('4.0%')).toBeInTheDocument());
    expect(within(chip).getByText('Apollo')).toBeInTheDocument();
    expect(within(chip).getByText(/:5173/)).toBeInTheDocument();
    expect(within(chip).getByText('200 MB')).toBeInTheDocument();
  });

  it('collapses several runs into a count with their total usage', async () => {
    runs([DEV, { id: 'api', title: 'Zeus', run: runInfo('API', 'dotnet run') }]);
    setupRuns([status('dev'), status('api', { cpuPercent: 6, memBytes: 300 * MB })]);

    const chip = await screen.findByRole('button', { name: '2 project runs' });
    expect(within(chip).getByText('2 runs')).toBeInTheDocument();
    await waitFor(() => expect(within(chip).getByText('10%')).toBeInTheDocument());
    expect(within(chip).getByText('500 MB')).toBeInTheDocument();
  });

  it('names the device a mobile run went to, as the Android page knows it', async () => {
    runs([{ id: 'app', title: 'Hermes', run: runInfo('App', 'flutter run', 'mobile') }], {
      app: { urls: [], devices: ['emulator-5554'] },
    });
    setupRuns([status('app')]);

    const chip = await screen.findByRole('button', { name: 'Hermes: App' });
    expect(within(chip).getByText('emulator-5554')).toBeInTheDocument();
  });

  it('says a mobile run is still waiting for a device', async () => {
    runs([{ id: 'app', title: 'Hermes', run: runInfo('App', 'flutter run', 'mobile') }]);
    setupRuns([status('app')]);

    const chip = await screen.findByRole('button', { name: 'Hermes: App' });
    expect(within(chip).getByText('waiting for device')).toBeInTheDocument();
  });

  it('marks a run whose command has finished', async () => {
    runs([{ ...DEV, run: { ...runInfo('Dev', 'pnpm dev'), startedAt: Date.now() - 600_000 } }]);
    setupRuns([status('dev', { processCount: 1 })]);

    const chip = await screen.findByRole('button', { name: 'Apollo: Dev' });
    await waitFor(() => expect(chip.querySelector('[data-state-dot="idle"]')).toBeInTheDocument());
  });

  it('stops a run from its panel, closing its terminal', async () => {
    runs([DEV]);
    const { user, bridge } = setupRuns([status('dev')]);

    await user.click(await screen.findByRole('button', { name: 'Apollo: Dev' }));
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText('pnpm dev')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Stop Dev' }));

    expect(bridge.$fn('terminal.kill')).toHaveBeenCalledWith('dev');
    expect(useTerminalStore.getState().sessions).toEqual([]);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Apollo: Dev' })).not.toBeInTheDocument(),
    );
  });

  it("opens the run's terminal in the drawer", async () => {
    runs([{ id: 'shell', title: 'PowerShell' }, DEV]);
    const { user } = setupRuns([status('dev')]);

    await user.click(await screen.findByRole('button', { name: 'Apollo: Dev' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /Show terminal/ }),
    );

    expect(useTerminalStore.getState()).toMatchObject({ activeSessionId: 'dev', isOpen: true });
  });

  it('opens the address in the browser', async () => {
    runs([DEV], { dev: { urls: ['http://localhost:5173/'], devices: [] } });
    const { user, bridge } = setupRuns([status('dev', { ports: [5173] })]);

    await user.click(await screen.findByRole('button', { name: 'Apollo: Dev' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: /http:\/\/localhost:5173\//,
      }),
    );

    expect(bridge.$fn('shell.openExternal')).toHaveBeenCalledWith('http://localhost:5173/');
  });

  it('stays out of the bar, and measures nothing, with no runs', async () => {
    runs([{ id: 'shell', title: 'PowerShell' }]);
    const { bridge } = setupRuns([]);

    await screen.findByRole('contentinfo', { name: 'Status bar' });
    expect(screen.queryByRole('button', { name: /project runs|: Dev/ })).not.toBeInTheDocument();
    // Reading usage scans every process, so it never happens without a run to show.
    expect(() => bridge.$fn('terminal.runStatus')).toThrow();
  });
});
