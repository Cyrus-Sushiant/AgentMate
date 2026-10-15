import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_THRESHOLDS,
  advanceDocker,
  advanceEmulators,
  appendBounded,
  createActivityState,
  describeResources,
  forgetResources,
  resourceKey,
  takeNewlyIdle,
  usagePoint,
} from './activity.js';
import type { DockerObservation, EmulatorObservation } from './types.js';

const TICK = 30_000;
const MIN = 60_000;

function container(overrides: Partial<DockerObservation> = {}): DockerObservation {
  return {
    id: 'c1',
    name: 'postgres',
    image: 'postgres:16',
    cpuPercent: 0,
    memBytes: 100,
    netBytes: 1000,
    blockBytes: 5000,
    ...overrides,
  };
}

function emulator(overrides: Partial<EmulatorObservation> = {}): EmulatorObservation {
  return {
    serial: 'emulator-5554',
    avdName: 'Pixel_7',
    cpuPercent: 3,
    memBytes: 2000,
    measurable: true,
    ...overrides,
  };
}

/** Feeds the same observation list at each time, one per tick, and returns the final state. */
function run(
  observations: (DockerObservation | null)[],
  start = 0,
  tick = TICK,
): ReturnType<typeof createActivityState> {
  let state = createActivityState();
  observations.forEach((obs, index) => {
    state = advanceDocker(state, obs ? [obs] : [], start + index * tick, TICK);
  });
  return state;
}

describe('docker activity', () => {
  it('starts the idle clock when a container is first seen', () => {
    const state = advanceDocker(createActivityState(), [container()], 5_000, TICK);
    const [only] = describeResources(state, 5_000, 20);
    expect(only).toMatchObject({
      name: 'postgres',
      detail: 'postgres:16',
      firstSeenAt: 5_000,
      lastActiveAt: 5_000,
      idleForMs: 0,
      idle: false,
    });
  });

  it('goes idle once it has been quiet for the threshold', () => {
    const quiet = Array.from({ length: 41 }, () => container());
    const state = run(quiet);
    const now = 40 * TICK;
    expect(describeResources(state, now, 20)[0]?.idle).toBe(true);
    expect(describeResources(state, now, 21)[0]?.idle).toBe(false);
  });

  it('applies a new threshold straight away without resetting anything', () => {
    const state = run(Array.from({ length: 11 }, () => container()));
    const now = 10 * TICK;
    expect(describeResources(state, now, 10)[0]?.idle).toBe(false);
    expect(describeResources(state, now, 5)[0]?.idle).toBe(true);
  });

  it('counts CPU at the threshold as activity', () => {
    const busy = container({ cpuPercent: ACTIVITY_THRESHOLDS.dockerCpuPercent });
    const state = run([container(), busy]);
    expect(describeResources(state, TICK, 20)[0]?.lastActiveAt).toBe(TICK);
  });

  it('ignores CPU just under the threshold', () => {
    const state = run([container(), container({ cpuPercent: 1.9 })]);
    expect(describeResources(state, TICK, 20)[0]?.lastActiveAt).toBe(0);
  });

  it('counts network traffic as activity even at 0% CPU', () => {
    // 64 B/s over a 30 s tick is 1920 bytes.
    const state = run([container(), container({ netBytes: 1000 + 2_000 })]);
    expect(describeResources(state, TICK, 20)[0]?.lastActiveAt).toBe(TICK);
  });

  it('ignores a trickle of network traffic', () => {
    const state = run([container(), container({ netBytes: 1000 + 500 })]);
    expect(describeResources(state, TICK, 20)[0]?.lastActiveAt).toBe(0);
  });

  it('counts disk writes as activity', () => {
    // 1 KiB/s over 30 s is 30720 bytes.
    const state = run([container(), container({ blockBytes: 5000 + 40_000 })]);
    expect(describeResources(state, TICK, 20)[0]?.lastActiveAt).toBe(TICK);
  });

  it('treats a counter that went down as a restart, which is activity', () => {
    const state = run([container({ netBytes: 9_000_000 }), container({ netBytes: 10 })]);
    expect(describeResources(state, TICK, 20)[0]?.lastActiveAt).toBe(TICK);
  });

  it('never reads an unreadable container as idle', () => {
    const blind = container({ cpuPercent: null, netBytes: null, blockBytes: null });
    const state = run([blind, blind, blind]);
    expect(describeResources(state, 2 * TICK, 20)[0]?.lastActiveAt).toBe(2 * TICK);
  });

  it('falls back to CPU alone when the I/O counters are missing', () => {
    const noIo = container({ netBytes: null, blockBytes: null });
    const state = run([noIo, noIo]);
    expect(describeResources(state, TICK, 20)[0]?.lastActiveAt).toBe(0);
  });

  it('forgets a container that is no longer running, and restarts its clock if it returns', () => {
    const state = run([container(), container(), null, container()]);
    expect(describeResources(state, 3 * TICK, 20)[0]?.firstSeenAt).toBe(3 * TICK);
  });

  it('forgets every container when Docker cannot be read', () => {
    let state = advanceDocker(createActivityState(), [container()], 0, TICK);
    state = advanceDocker(state, null, TICK, TICK);
    expect(describeResources(state, TICK, 20)).toEqual([]);
    expect(state.lastSampleAt.docker).toBeUndefined();
  });

  it('does not count unobserved time as idle after a long gap', () => {
    let state = advanceDocker(createActivityState(), [container()], 0, TICK);
    state = advanceDocker(state, [container()], TICK, TICK);
    // The machine slept for an hour.
    const wake = TICK + 60 * MIN;
    state = advanceDocker(state, [container()], wake, TICK);
    const [only] = describeResources(state, wake, 20);
    expect(only?.lastActiveAt).toBe(wake);
    expect(only?.firstSeenAt).toBe(0);
    expect(only?.idle).toBe(false);
  });

  it('does not compute a rate across a gap', () => {
    let state = advanceDocker(createActivityState(), [container()], 0, TICK);
    const wake = 60 * MIN;
    state = advanceDocker(state, [container({ netBytes: 1000 })], wake, TICK);
    // The next normal tick compares against the post-gap reading.
    state = advanceDocker(state, [container({ netBytes: 1000 })], wake + TICK, TICK);
    expect(describeResources(state, wake + TICK, 20)[0]?.lastActiveAt).toBe(wake);
  });
});

describe('emulator activity', () => {
  function runEmu(observations: EmulatorObservation[]): ReturnType<typeof createActivityState> {
    let state = createActivityState();
    observations.forEach((obs, index) => {
      state = advanceEmulators(state, [obs], index * TICK, TICK);
    });
    return state;
  }

  it('names the emulator by its AVD and keeps the serial as detail', () => {
    const state = runEmu([emulator()]);
    expect(describeResources(state, 0, 20)[0]).toMatchObject({
      kind: 'emulator',
      id: 'emulator-5554',
      name: 'Pixel_7',
      detail: 'emulator-5554',
    });
  });

  it('is active at the CPU threshold and quiet just under it', () => {
    const busy = runEmu([
      emulator(),
      emulator({ cpuPercent: ACTIVITY_THRESHOLDS.emulatorCpuPercent }),
    ]);
    expect(describeResources(busy, TICK, 20)[0]?.lastActiveAt).toBe(TICK);
    const quiet = runEmu([emulator(), emulator({ cpuPercent: 24 })]);
    expect(describeResources(quiet, TICK, 20)[0]?.lastActiveAt).toBe(0);
  });

  it('counts a CPU that is not ready yet as active', () => {
    const state = runEmu([emulator(), emulator({ cpuPercent: null })]);
    expect(describeResources(state, TICK, 20)[0]?.lastActiveAt).toBe(TICK);
  });

  it('never calls an emulator idle when it cannot be measured', () => {
    const state = runEmu(Array.from({ length: 80 }, () => emulator({ measurable: false })));
    const [only] = describeResources(state, 79 * TICK, 1);
    expect(only).toMatchObject({ measurable: false, idle: false, idleForMs: 0 });
  });

  it('keeps docker and emulator records apart', () => {
    let state = advanceDocker(createActivityState(), [container()], 0, TICK);
    state = advanceEmulators(state, [emulator()], 0, TICK);
    state = advanceEmulators(state, null, TICK, TICK);
    expect(describeResources(state, TICK, 20).map((r) => r.kind)).toEqual(['docker']);
  });
});

describe('describeResources', () => {
  it('lists idle resources first, longest quiet first', () => {
    let state = createActivityState();
    state = advanceDocker(state, [container({ id: 'a', name: 'a' })], 0, TICK);
    state = advanceDocker(
      state,
      [container({ id: 'a', name: 'a' }), container({ id: 'b', name: 'b' })],
      10 * MIN,
      20 * MIN,
    );
    state = advanceDocker(
      state,
      [
        container({ id: 'a', name: 'a' }),
        container({ id: 'b', name: 'b' }),
        container({ id: 'c', name: 'c' }),
      ],
      25 * MIN,
      20 * MIN,
    );
    const list = describeResources(state, 40 * MIN, 20);
    expect(list.map((r) => [r.name, r.idle])).toEqual([
      ['a', true],
      ['b', true],
      ['c', false],
    ]);
  });
});

describe('takeNewlyIdle', () => {
  it('reports a resource once per idle stretch', () => {
    const state = run(Array.from({ length: 41 }, () => container()));
    const now = 40 * TICK;
    const first = takeNewlyIdle(state, now, 20);
    expect(first.newlyIdle.map((r) => r.name)).toEqual(['postgres']);
    expect(takeNewlyIdle(first.state, now, 20).newlyIdle).toEqual([]);
  });

  it('re-arms once the resource is active again', () => {
    let state = run(Array.from({ length: 41 }, () => container()));
    state = takeNewlyIdle(state, 40 * TICK, 20).state;
    state = advanceDocker(state, [container({ cpuPercent: 50 })], 41 * TICK, TICK);
    expect(state.records[resourceKey('docker', 'c1')]?.notified).toBe(false);
    // Quiet for another 20 minutes.
    for (let i = 42; i <= 82; i++) state = advanceDocker(state, [container()], i * TICK, TICK);
    expect(takeNewlyIdle(state, 82 * TICK, 20).newlyIdle).toHaveLength(1);
  });

  it('reports nothing and keeps the same state when nothing is idle', () => {
    const state = run([container()]);
    const result = takeNewlyIdle(state, 0, 20);
    expect(result.newlyIdle).toEqual([]);
    expect(result.state).toBe(state);
  });
});

describe('forgetResources', () => {
  it('drops the named records only', () => {
    let state = advanceDocker(
      createActivityState(),
      [container({ id: 'a' }), container({ id: 'b' })],
      0,
      TICK,
    );
    state = forgetResources(state, [resourceKey('docker', 'a')]);
    expect(describeResources(state, 0, 20).map((r) => r.id)).toEqual(['b']);
  });
});

describe('usagePoint', () => {
  it('totals each kind separately and counts them', () => {
    let state = advanceDocker(
      createActivityState(),
      [
        container({ id: 'a', cpuPercent: 10, memBytes: 100 }),
        container({ id: 'b', cpuPercent: null, memBytes: null }),
      ],
      0,
      TICK,
    );
    state = advanceEmulators(state, [emulator({ cpuPercent: 40, memBytes: 900 })], 0, TICK);
    expect(usagePoint(state, 7)).toEqual({
      at: 7,
      dockerCpu: 10,
      dockerMem: 100,
      dockerCount: 2,
      emulatorCpu: 40,
      emulatorMem: 900,
      emulatorCount: 1,
    });
  });
});

describe('appendBounded', () => {
  it('keeps the newest entries up to the limit without mutating the input', () => {
    const input = [1, 2, 3];
    expect(appendBounded(input, 4, 3)).toEqual([2, 3, 4]);
    expect(input).toEqual([1, 2, 3]);
  });

  it('holds two hours of 30 second points by default', () => {
    let points: number[] = [];
    for (let i = 0; i < 300; i++) points = appendBounded(points, i);
    expect(points).toHaveLength(ACTIVITY_THRESHOLDS.historyPoints);
    expect(points[0]).toBe(60);
  });
});
