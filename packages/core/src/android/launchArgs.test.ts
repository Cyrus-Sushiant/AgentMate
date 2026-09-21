import { describe, expect, it } from 'vitest';
import { emulatorLaunchArgs, nextFreeConsolePort } from './launchArgs.js';

describe('emulatorLaunchArgs', () => {
  it('always names the AVD and pins the console port', () => {
    // Pinning the port is what makes the serial predictable, so there is no race between
    // launching and working out which emulator-NNNN we just started.
    expect(emulatorLaunchArgs({ avdName: 'Pixel_7_API_34', port: 5554 })).toEqual([
      '-avd',
      'Pixel_7_API_34',
      '-port',
      '5554',
    ]);
  });

  it('adds the cold boot and wipe flags only when asked', () => {
    const cold = emulatorLaunchArgs({ avdName: 'A', port: 5554, coldBoot: true });
    expect(cold).toContain('-no-snapshot-load');
    expect(cold).not.toContain('-wipe-data');

    const wiped = emulatorLaunchArgs({ avdName: 'A', port: 5554, wipeData: true });
    expect(wiped).toContain('-wipe-data');
  });

  it('passes the graphics mode through', () => {
    expect(emulatorLaunchArgs({ avdName: 'A', port: 5554, gpu: 'host' })).toContain('-gpu');
    expect(emulatorLaunchArgs({ avdName: 'A', port: 5554, gpu: 'host' })).toContain('host');
    expect(emulatorLaunchArgs({ avdName: 'A', port: 5554 })).not.toContain('-gpu');
  });

  it('appends the user extra flags last so they can override the defaults', () => {
    const args = emulatorLaunchArgs({
      avdName: 'A',
      port: 5554,
      gpu: 'auto',
      extraArgs: ['-no-boot-anim', '-memory', '4096'],
    });
    expect(args.slice(-3)).toEqual(['-no-boot-anim', '-memory', '4096']);
  });

  it('never lets an empty extra flag through', () => {
    expect(emulatorLaunchArgs({ avdName: 'A', port: 5554, extraArgs: ['', '  '] })).toEqual([
      '-avd',
      'A',
      '-port',
      '5554',
    ]);
  });
});

describe('nextFreeConsolePort', () => {
  it('starts at 5554 and only uses even ports', () => {
    expect(nextFreeConsolePort([])).toBe(5554);
    expect(nextFreeConsolePort([5554])).toBe(5556);
    expect(nextFreeConsolePort([5554, 5556, 5558])).toBe(5560);
  });

  it('skips ports already taken, in any order', () => {
    expect(nextFreeConsolePort([5558, 5554])).toBe(5556);
  });

  it('returns null when the emulator port range is full', () => {
    const all: number[] = [];
    for (let port = 5554; port <= 5584; port += 2) all.push(port);
    expect(nextFreeConsolePort(all)).toBeNull();
  });
});
