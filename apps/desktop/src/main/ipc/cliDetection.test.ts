import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CliUpdateCheckResult, InstalledCli } from '@agentmat/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import { tempDir } from '../../test/main/fixtures';
import {
  expectChannelsCovered,
  invoke,
  loadIpc,
  useTempUserData,
} from '../../test/main/ipcHarness';

/**
 * Whether each AI CLI is installed, which the Dashboard, CLI Manager, Tools and Project Detail all
 * ask for. A full sweep spawns a child process per registry entry, so the answer is cached and
 * concurrent callers share one sweep: that bookkeeping is the part worth pinning, along with a
 * missing CLI being remembered only briefly so one installed since shows up.
 *
 * The probe looks for real executables on PATH, so a fake one is put on a temp PATH rather than
 * mocking the child process layer.
 */

useTempUserData();
expectChannelsCovered(IPC.cli);

const fetchMock = vi.fn();
let binDir = '';

async function register(): Promise<void> {
  await loadIpc(
    () => import('./cliDetection'),
    (module) => module.registerCliDetectionHandlers(),
  );
}

/** A `claude` on PATH that answers --version, the way CLI detection expects. */
function writeFakeClaude(version = '9.9.9'): void {
  if (process.platform === 'win32') {
    writeFileSync(
      join(binDir, 'claude.cmd'),
      ['@echo off', `echo ${version} (Claude Code)`, ''].join('\r\n'),
    );
    return;
  }
  const script = join(binDir, 'claude');
  writeFileSync(script, ['#!/bin/sh', `echo "${version} (Claude Code)"`, ''].join('\n'));
  chmodSync(script, 0o755);
}

function claude(list: InstalledCli[]): InstalledCli | undefined {
  return list.find((one) => one.id === 'claude-code');
}

beforeEach(async () => {
  binDir = join(tempDir('agentmate-clis-'), 'bin');
  mkdirSync(binDir, { recursive: true });
  const key = Object.keys(process.env).find((one) => one.toUpperCase() === 'PATH') ?? 'PATH';
  // Only the fake binaries are on PATH, so a CLI really installed on this machine cannot make
  // the result depend on who is running the tests.
  vi.stubEnv(key, binDir);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  await register();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('detecting installed CLIs', () => {
  it('reports every CLI in the registry, installed or not', async () => {
    const list = await invoke<InstalledCli[]>(IPC.cli.detectAll, true);

    expect(list.length).toBeGreaterThan(5);
    expect(claude(list)).toBeDefined();
  });

  it('finds a CLI that is on PATH and names the file it found', async () => {
    writeFakeClaude();

    const found = claude(await invoke<InstalledCli[]>(IPC.cli.detectAll, true));

    // Finding the executable is what decides "installed", rather than a version answering in
    // time, so that is asserted on both platforms.
    expect(found?.installed).toBe(true);
    expect(found?.executablePath?.toLowerCase()).toContain('claude');
  });

  it.skipIf(process.platform === 'win32')('reads the version the CLI prints', async () => {
    // Skipped on Windows: the probe runs the executable directly, and a .cmd shim needs a shell,
    // so the version comes back null there even though the CLI is found.
    writeFakeClaude();

    const found = claude(await invoke<InstalledCli[]>(IPC.cli.detectAll, true));

    expect(found?.version).toContain('9.9.9');
  });

  it('reports one that is nowhere on PATH as missing', async () => {
    const found = claude(await invoke<InstalledCli[]>(IPC.cli.detectAll, true));

    expect(found?.installed).toBe(false);
    expect(found?.executablePath).toBeFalsy();
  });

  it('serves a second caller from the cache instead of sweeping again', async () => {
    writeFakeClaude();
    const first = await invoke<InstalledCli[]>(IPC.cli.detectAll);

    // A sweep spawns a process per registry entry, which is why navigation between pages must
    // not start a new one each time.
    const second = await invoke<InstalledCli[]>(IPC.cli.detectAll);

    expect(second).toBe(first);
  });

  it('sweeps again when the caller forces a refresh', async () => {
    const before = claude(await invoke<InstalledCli[]>(IPC.cli.detectAll));
    expect(before?.installed).toBe(false);

    // What the Refresh button in the CLI Manager does, after the user installed something.
    writeFakeClaude();
    const after = claude(await invoke<InstalledCli[]>(IPC.cli.detectAll, true));

    expect(after?.installed).toBe(true);
  });

  it('notices a CLI installed a moment ago, because a missing result is kept only briefly', async () => {
    // Only the clock is faked: the sweep itself spawns processes and reads files, which need
    // real timers to finish.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      await invoke<InstalledCli[]>(IPC.cli.detectAll);
      writeFakeClaude();

      // Past the short window a sweep with something missing is cached for, but well inside the
      // long one a complete sweep would get.
      vi.setSystemTime(Date.now() + 25_000);

      const after = claude(await invoke<InstalledCli[]>(IPC.cli.detectAll));
      expect(after?.installed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('install and update commands', () => {
  it('gives the install command for this OS', async () => {
    const command = await invoke<string | null>(IPC.cli.getInstallCommand, 'claude-code');

    expect(command).toBeTruthy();
  });

  it('answers null for a CLI it has never heard of', async () => {
    await expect(invoke(IPC.cli.getInstallCommand, 'not-a-cli')).resolves.toBeNull();
    await expect(invoke(IPC.cli.getUpdateCommand, 'not-a-cli')).resolves.toBeNull();
  });

  it('gives the update command for this OS', async () => {
    await expect(invoke(IPC.cli.getUpdateCommand, 'claude-code')).resolves.toBeTruthy();
  });
});

describe('checking for a newer version', () => {
  it('says an update is available when the registry has a higher version', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: '2.0.0' }),
    } as Response);

    const result = await invoke<CliUpdateCheckResult>(
      IPC.cli.checkForUpdate,
      'claude-code',
      '1.0.0',
    );

    expect(result).toMatchObject({
      supported: true,
      latestVersion: '2.0.0',
      updateAvailable: true,
    });
  });

  it('says no update when the installed version is already the latest', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: '1.0.0' }),
    } as Response);

    const result = await invoke<CliUpdateCheckResult>(
      IPC.cli.checkForUpdate,
      'claude-code',
      '1.0.0',
    );

    expect(result.updateAvailable).toBe(false);
  });

  it('reports unsupported rather than failing for a CLI with no update source', async () => {
    const result = await invoke<CliUpdateCheckResult>(IPC.cli.checkForUpdate, 'not-a-cli', '1.0.0');

    expect(result).toMatchObject({ supported: false, latestVersion: null, updateAvailable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('claims no update when the version cannot be read, rather than guessing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as Response);

    const result = await invoke<CliUpdateCheckResult>(
      IPC.cli.checkForUpdate,
      'claude-code',
      '1.0.0',
    );

    expect(result.updateAvailable).toBe(false);
  });
});
