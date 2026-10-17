import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tempDir } from '../../test/main/fixtures';

// Reading the registry would pull the real machine's PATH back in and make these results depend on
// what is installed here. The pieces under test are the wiring, not the registry refresh.
vi.mock('../windowsPath', () => ({
  refreshWindowsPath: vi.fn(async () => undefined),
  pathKey: (env: NodeJS.ProcessEnv) =>
    Object.keys(env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH',
}));

import { getDevSetupService } from './runtime';

/**
 * The glue that points the detectors at the real machine. The logic is covered where it lives; this
 * proves the pieces are connected, using a fake tool on a temp PATH so the result does not depend
 * on what happens to be installed on the machine running the tests.
 */

const onWindows = process.platform === 'win32';
let binDir = '';

function writeFakeNode(version: string): void {
  if (onWindows) {
    writeFileSync(join(binDir, 'node.cmd'), ['@echo off', `echo v${version}`, ''].join('\r\n'));
    return;
  }
  const file = join(binDir, 'node');
  writeFileSync(file, ['#!/bin/sh', `echo "v${version}"`, ''].join('\n'));
  chmodSync(file, 0o755);
}

beforeEach(() => {
  binDir = join(tempDir('agentmate-devsetup-'), 'bin');
  mkdirSync(binDir, { recursive: true });
  const key = Object.keys(process.env).find((one) => one.toUpperCase() === 'PATH') ?? 'PATH';
  const system = onWindows
    ? [join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')]
    : ['/usr/bin', '/bin'];
  vi.stubEnv(key, [binDir, ...system].join(delimiter));
  // Fallback locations are read from these, so they have to point somewhere empty.
  vi.stubEnv('ProgramFiles', join(binDir, 'no-program-files'));
  vi.stubEnv('LOCALAPPDATA', join(binDir, 'no-local-app-data'));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the Dev Setup service', () => {
  it('finds a tool that is on PATH and reads its version', async () => {
    writeFakeNode('22.12.0');

    const result = await getDevSetupService().detect('node', { force: true });

    expect(result).toMatchObject({ state: 'found', version: '22.12.0', onPath: true });
  });

  it('reports a tool that is nowhere as absent', async () => {
    const result = await getDevSetupService().detect('pnpm', { force: true });

    expect(result).toEqual({ state: 'absent' });
  });

  it('remembers what it found, so the nav badge can read it without probing', async () => {
    writeFakeNode('22.12.0');
    const service = getDevSetupService();
    await service.detect('node', { force: true });

    // `gh` is never checked in this file, and the service (and its memory) is shared by every test.
    expect(service.peek(['node', 'gh'])).toMatchObject({
      node: { state: 'found' },
      gh: undefined,
    });
  });

  it('describes the machine: its OS, CPU and package managers', async () => {
    const environment = await getDevSetupService().environment({ force: true });

    expect(environment.os).toBe(
      process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux',
    );
    expect(['x64', 'arm64', 'other']).toContain(environment.arch);
    expect(Array.isArray(environment.packageManagers)).toBe(true);
  });

  it('hands every caller the same service', () => {
    expect(getDevSetupService()).toBe(getDevSetupService());
  });
});

describe('the Dev Setup service: installs', () => {
  it('has nothing running to begin with', () => {
    expect(getDevSetupService().jobState()).toMatchObject({ running: false, items: {}, order: [] });
  });

  it('refuses to install something that is not in the catalog, before running anything', async () => {
    await expect(getDevSetupService().install({ ids: ['definitely-not-real'] })).rejects.toThrow(
      'Unknown dev setup item.',
    );
  });

  it('does nothing when asked to cancel with nothing running', () => {
    expect(() => getDevSetupService().cancel()).not.toThrow();
    expect(() => getDevSetupService().cancel('git')).not.toThrow();
  });

  it('stops cleanly on dispose when nothing is running', () => {
    expect(() => getDevSetupService().dispose()).not.toThrow();
  });
});
