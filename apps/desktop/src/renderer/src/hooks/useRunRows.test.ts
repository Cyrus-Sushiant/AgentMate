import type { AndroidSnapshot } from '@agentmat/core';
import type { TerminalRunStatusResult } from '@shared/apiTypes';
import { describe, expect, it } from 'vitest';
import type { RunSessionMeta } from '@/stores/runSessionStore';
import { buildRunRows, pickRunDevice, pickRunUrl, resolveRunDevice } from './useRunRows';

/**
 * How a run's row in the status bar is put together from what the run printed and what the OS
 * says it is doing: which address to offer, which device to name, and whether it is still going.
 */

const NOW = 1_000_000;

function runSession(id: string, kind: 'web' | 'mobile' | 'other' = 'web', startedAt = 0) {
  return {
    id,
    title: id,
    run: { commandId: 'c', label: 'Run', command: 'pnpm dev', kind, startedAt },
  } satisfies RunSessionMeta;
}

function status(
  sessionId: string,
  over: Partial<TerminalRunStatusResult['sessions'][number]> = {},
): TerminalRunStatusResult['sessions'][number] {
  return {
    sessionId,
    alive: true,
    cpuPercent: 4,
    memBytes: 200 * 1024 * 1024,
    processCount: 3,
    ports: [],
    ...over,
  };
}

function result(...sessions: TerminalRunStatusResult['sessions']): TerminalRunStatusResult {
  return { available: true, cpuReady: true, sessions };
}

const SNAPSHOT = {
  emulators: [
    {
      kind: 'emulator',
      avd: { name: 'Pixel_7_API_34', displayName: 'Pixel 7 API 34' },
      serial: 'emulator-5554',
      state: 'running',
    },
  ],
  physical: [
    {
      kind: 'physical',
      device: { serial: 'R58N123', model: 'Galaxy S23' },
    },
  ],
} as unknown as AndroidSnapshot;

describe('pickRunUrl', () => {
  it('offers the printed address whose port the run really listens on', () => {
    // Vite prints both; the run only got 5174 because 5173 was taken.
    expect(pickRunUrl(['http://localhost:5173/', 'http://localhost:5174/app'], [5174])).toBe(
      'http://localhost:5174/app',
    );
  });

  it('falls back to the lowest port when nothing printed matches', () => {
    expect(
      pickRunUrl(
        [],
        [8080, 3000].sort((a, b) => a - b),
      ),
    ).toBe('http://localhost:3000/');
  });

  it('uses a printed address before any port is known', () => {
    expect(pickRunUrl(['http://localhost:5173/'], [])).toBe('http://localhost:5173/');
  });

  it('has nothing to offer for a run with no address and no port', () => {
    expect(pickRunUrl([], [])).toBeNull();
  });
});

describe('resolveRunDevice', () => {
  it.each([
    ['emulator-5554', { name: 'Pixel 7 API 34', serial: 'emulator-5554' }],
    ['Pixel_7_API_34', { name: 'Pixel 7 API 34', serial: 'emulator-5554' }],
    ['R58N123', { name: 'Galaxy S23', serial: 'R58N123' }],
    ['Galaxy S23', { name: 'Galaxy S23', serial: 'R58N123' }],
  ])('puts %s to the device the Android page knows', (printed, expected) => {
    expect(resolveRunDevice(printed, SNAPSHOT)).toEqual(expected);
  });

  it('keeps a name it cannot place, without a link', () => {
    expect(resolveRunDevice('iPhone 15', SNAPSHOT)).toEqual({ name: 'iPhone 15', serial: null });
    expect(resolveRunDevice('emulator-5556', undefined)).toEqual({
      name: 'emulator-5556',
      serial: null,
    });
  });
});

describe('pickRunDevice', () => {
  it('prefers the readable name over a bare serial for the same phone', () => {
    // What Flutter really prints, in this order, with no Android SDK to look the serial up in.
    expect(pickRunDevice(['sdk gphone64 x86 64', 'emulator-5554'], undefined)).toEqual({
      name: 'sdk gphone64 x86 64',
      serial: null,
    });
  });

  it('prefers a device the Android page knows, so it can link to it', () => {
    expect(pickRunDevice(['sdk gphone64 x86 64', 'emulator-5554'], SNAPSHOT)).toEqual({
      name: 'Pixel 7 API 34',
      serial: 'emulator-5554',
    });
  });

  it('takes the latest of several readable names', () => {
    expect(pickRunDevice(['Pixel 7', 'Pixel Tablet'], undefined)?.name).toBe('Pixel Tablet');
  });

  it('falls back to a serial when that is all there is, and to nothing without devices', () => {
    expect(pickRunDevice(['emulator-5556'], undefined)?.name).toBe('emulator-5556');
    expect(pickRunDevice([], SNAPSHOT)).toBeNull();
  });
});

describe('buildRunRows', () => {
  it('joins usage, ports and the printed address for a web run', () => {
    const [row] = buildRunRows(
      [runSession('dev')],
      { dev: { urls: ['http://localhost:5173/'], devices: [] } },
      result(status('dev', { ports: [5173, 9229] })),
      undefined,
      NOW,
    );

    expect(row).toMatchObject({
      url: 'http://localhost:5173/',
      ports: [5173, 9229],
      mobile: false,
      device: null,
      state: 'running',
      cpuReady: true,
    });
    expect(row.status?.cpuPercent).toBe(4);
  });

  it('names the latest device a mobile run went to', () => {
    const [row] = buildRunRows(
      [runSession('app', 'mobile')],
      { app: { urls: [], devices: ['Pixel 7', 'emulator-5554'] } },
      result(status('app')),
      SNAPSHOT,
      NOW,
    );

    expect(row.mobile).toBe(true);
    expect(row.device).toEqual({ name: 'Pixel 7 API 34', serial: 'emulator-5554' });
  });

  it('treats a run as mobile once it names a device, whatever its command looked like', () => {
    // `pnpm start` in an Expo project reads as a web server until Expo opens on a phone.
    const [row] = buildRunRows(
      [runSession('expo', 'web')],
      { expo: { urls: [], devices: ['Pixel_7_API_34'] } },
      result(status('expo')),
      SNAPSHOT,
      NOW,
    );

    expect(row.mobile).toBe(true);
  });

  it('is starting until the first reading arrives', () => {
    const [row] = buildRunRows([runSession('dev')], {}, undefined, undefined, NOW);
    expect(row.state).toBe('starting');
    expect(row.status).toBeNull();
    expect(row.cpuReady).toBe(false);
  });

  it('is idle once only the shell is left, but not in the first seconds of a run', () => {
    const lone = result(status('old', { processCount: 1 }), status('new', { processCount: 1 }));
    const [old, fresh] = buildRunRows(
      [runSession('old', 'web', 0), runSession('new', 'web', NOW - 2000)],
      {},
      lone,
      undefined,
      NOW,
    );

    expect(old.state).toBe('idle');
    // The shell has not started the command's process yet.
    expect(fresh.state).toBe('starting');
  });

  it('is idle when the shell itself is gone', () => {
    const [row] = buildRunRows(
      [runSession('dev')],
      {},
      result(status('dev', { alive: false, processCount: 0 })),
      undefined,
      NOW,
    );
    expect(row.state).toBe('idle');
  });
});
