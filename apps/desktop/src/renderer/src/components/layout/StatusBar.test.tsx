import type { AndroidSdkStatus } from '@agentmat/core';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
