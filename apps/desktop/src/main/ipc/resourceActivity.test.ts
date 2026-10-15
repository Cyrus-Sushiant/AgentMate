import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import {
  expectChannelsCovered,
  invoke,
  loadIpc,
  useTempUserData,
} from '../../test/main/ipcHarness';

/**
 * The renderer can ask for the idle list and ask to stop things from it. The handler is the last
 * line of defence for the second one, so malformed references have to be refused here rather than
 * handed to the tracker.
 */

const tracker = vi.hoisted(() => ({
  snapshot: vi.fn(),
  stop: vi.fn(),
}));

// The real runtime binds Docker, adb and the settings store.
vi.mock('../resourceActivity/runtime', () => ({
  getResourceActivityTracker: () => tracker,
}));

useTempUserData();

expectChannelsCovered(IPC.resourceActivity);

beforeEach(async () => {
  tracker.snapshot.mockReset();
  tracker.stop.mockReset();
  await loadIpc(
    () => import('./resourceActivity'),
    (module) => module.registerResourceActivityHandlers(),
  );
});

describe('resourceActivity:snapshot', () => {
  it('returns the tracker snapshot', async () => {
    tracker.snapshot.mockResolvedValue({ resources: [] });

    await expect(invoke(IPC.resourceActivity.snapshot)).resolves.toEqual({ resources: [] });
    expect(tracker.snapshot).toHaveBeenCalledWith({ fresh: false });
  });

  it('asks for a fresh reading only when told to', async () => {
    tracker.snapshot.mockResolvedValue({});

    await invoke(IPC.resourceActivity.snapshot, { fresh: true });
    await invoke(IPC.resourceActivity.snapshot, { fresh: 'yes' });

    expect(tracker.snapshot).toHaveBeenNthCalledWith(1, { fresh: true });
    expect(tracker.snapshot).toHaveBeenNthCalledWith(2, { fresh: false });
  });
});

describe('resourceActivity:stop', () => {
  it('hands clean references and the idle-only flag to the tracker', async () => {
    tracker.stop.mockResolvedValue({ results: [] });
    const refs = [
      { kind: 'docker', id: 'abc' },
      { kind: 'emulator', id: 'emulator-5554' },
    ];

    await expect(invoke(IPC.resourceActivity.stop, refs, { onlyIfIdle: true })).resolves.toEqual({
      results: [],
    });

    expect(tracker.stop).toHaveBeenCalledWith(refs, { onlyIfIdle: true });
  });

  it('strips anything a caller attached beyond kind and id', async () => {
    tracker.stop.mockResolvedValue({ results: [] });

    await invoke(IPC.resourceActivity.stop, [{ kind: 'docker', id: 'abc', extra: 'x' }]);

    expect(tracker.stop).toHaveBeenCalledWith([{ kind: 'docker', id: 'abc' }], {
      onlyIfIdle: false,
    });
  });

  it.each([
    ['not an array', 'abc'],
    ['an object', { kind: 'docker', id: 'a' }],
    ['an unknown kind', [{ kind: 'vm', id: 'a' }]],
    ['an empty id', [{ kind: 'docker', id: '' }]],
    ['a non-string id', [{ kind: 'docker', id: 42 }]],
    ['a null entry', [null]],
    ['an oversize id', [{ kind: 'docker', id: 'x'.repeat(201) }]],
    [
      'too many entries',
      Array.from({ length: 51 }, (_, index) => ({ kind: 'docker', id: `c${index}` })),
    ],
  ])('refuses %s', async (_label, refs) => {
    await expect(invoke(IPC.resourceActivity.stop, refs)).rejects.toThrow(
      'Invalid resources to stop.',
    );
    expect(tracker.stop).not.toHaveBeenCalled();
  });

  it('accepts exactly the maximum number of entries', async () => {
    tracker.stop.mockResolvedValue({ results: [] });
    const refs = Array.from({ length: 50 }, (_, index) => ({ kind: 'docker', id: `c${index}` }));

    await invoke(IPC.resourceActivity.stop, refs);

    expect(tracker.stop).toHaveBeenCalledTimes(1);
  });
});
