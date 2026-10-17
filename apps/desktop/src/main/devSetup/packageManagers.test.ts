import { describe, expect, it, vi } from 'vitest';
import { createPackageManagerDetector } from './packageManagers';
import type { ProbeResult } from './probe';

function result(ok: boolean): ProbeResult {
  return {
    ok,
    code: ok ? 0 : 1,
    stdout: '',
    stderr: '',
    output: '',
    notFound: !ok,
    timedOut: false,
    error: null,
  };
}

/** A probe that succeeds only for the commands listed. */
function probeFor(...available: string[]) {
  return vi.fn(async (command: string) => result(available.includes(command)));
}

describe('package manager detection', () => {
  it('finds winget on Windows', async () => {
    const detector = createPackageManagerDetector({
      os: 'win32',
      probe: probeFor('winget'),
      now: () => 0,
    });

    expect(await detector.detect()).toEqual(['winget']);
  });

  it('reports none when winget is missing, as on an older Windows 10', async () => {
    const detector = createPackageManagerDetector({ os: 'win32', probe: probeFor(), now: () => 0 });

    expect(await detector.detect()).toEqual([]);
  });

  it('finds Homebrew on a Mac', async () => {
    const detector = createPackageManagerDetector({
      os: 'darwin',
      probe: probeFor('brew'),
      now: () => 0,
    });

    expect(await detector.detect()).toEqual(['brew']);
  });

  it('lists the Linux managers in the order they are preferred', async () => {
    const detector = createPackageManagerDetector({
      os: 'linux',
      probe: probeFor('pacman', 'apt-get'),
      now: () => 0,
    });

    expect(await detector.detect()).toEqual(['apt-get', 'pacman']);
  });

  it('only asks about managers that exist on that OS', async () => {
    const probe = probeFor('winget', 'brew', 'apt-get');
    await createPackageManagerDetector({ os: 'linux', probe, now: () => 0 }).detect();

    const asked = probe.mock.calls.map((call) => call[0]);
    expect(asked).toEqual(['apt-get', 'dnf', 'pacman']);
  });

  it('remembers the answer for a minute, then looks again', async () => {
    let clock = 0;
    const probe = probeFor('winget');
    const detector = createPackageManagerDetector({ os: 'win32', probe, now: () => clock });

    await detector.detect();
    clock = 59_000;
    await detector.detect();
    expect(probe).toHaveBeenCalledTimes(1);

    clock = 61_000;
    await detector.detect();
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('looks again straight away when forced, for after the user installs one', async () => {
    const probe = probeFor('winget');
    const detector = createPackageManagerDetector({ os: 'win32', probe, now: () => 0 });

    await detector.detect();
    await detector.detect({ force: true });

    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('shares one lookup between callers that ask at the same time', async () => {
    const probe = probeFor('winget');
    const detector = createPackageManagerDetector({ os: 'win32', probe, now: () => 0 });

    const [first, second] = await Promise.all([detector.detect(), detector.detect()]);

    expect(first).toEqual(second);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('treats a probe that throws as that manager being absent', async () => {
    const probe = vi.fn(async () => {
      throw new Error('boom');
    });
    const detector = createPackageManagerDetector({ os: 'win32', probe, now: () => 0 });

    expect(await detector.detect()).toEqual([]);
  });
});
