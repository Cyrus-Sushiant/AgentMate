import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Turning `adb devices -l` into the cards the page shows. The interesting parts are that an
 * emulator serial is resolved back to the AVD it belongs to, that a device which is not ready
 * is never asked for properties it cannot answer, and that one slow device does not sink the
 * whole list.
 */

const state = vi.hoisted(() => ({
  /** Answers keyed by a substring of the argv, so a test only spells out what it needs. */
  answers: [] as { match: string; stdout?: string; error?: string }[],
  calls: [] as string[][],
}));

vi.mock('./exec', () => ({
  AndroidCommandError: class extends Error {},
  AndroidToolMissingError: class extends Error {},
  runAdb: (_sdk: unknown, args: string[]) => {
    state.calls.push(args);
    const line = args.join(' ');
    const answer = state.answers.find((a) => line.includes(a.match));
    if (answer?.error) return Promise.reject(new Error(answer.error));
    return Promise.resolve(answer?.stdout ?? '');
  },
}));

const sdk = { paths: { adb: '/sdk/platform-tools/adb' } } as never;

const DEVICES = [
  'List of devices attached',
  'emulator-5554          device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 transport_id:3',
  'R58M20ABCDE            device usb:1-4 product:a52qnaxx model:SM_A525F transport_id:5',
  '2B141FDH2000XX         unauthorized usb:1-7 transport_id:9',
  'emulator-5556          offline transport_id:11',
  '',
].join('\n');

const GETPROP = [
  '[ro.build.version.release]: [14]',
  '[ro.build.version.sdk]: [34]',
  '[ro.product.model]: [Galaxy A52]',
  '',
].join('\n');

beforeEach(() => {
  state.answers.length = 0;
  state.calls.length = 0;
  state.answers.push({ match: 'devices -l', stdout: DEVICES });
});

describe('listAttached', () => {
  it('separates emulator serials from physical devices', async () => {
    const { listAttached } = await import('./devices');
    state.answers.push({ match: 'emu avd name', stdout: 'Pixel_7_API_34\nOK\n' });
    state.answers.push({ match: 'getprop', stdout: GETPROP });

    const { emulators, physical } = await listAttached(sdk);

    // The adb state rides along: an emulator still coming up reports `offline`, which is what
    // tells the lifecycle manager the difference between connecting and booting.
    expect(emulators.map((d) => [d.serial, d.state])).toEqual([
      ['emulator-5554', 'device'],
      ['emulator-5556', 'offline'],
    ]);
    expect(physical.map((d) => d.device.serial)).toEqual(['R58M20ABCDE', '2B141FDH2000XX']);
  });

  it('reads the Android version of a device that is ready', async () => {
    const { listAttached } = await import('./devices');
    state.answers.push({ match: 'getprop', stdout: GETPROP });

    const { physical } = await listAttached(sdk);
    const ready = physical.find((d) => d.device.serial === 'R58M20ABCDE');

    expect(ready).toMatchObject({ androidVersion: '14', api: 34 });
  });

  it('never runs getprop against a device that is not ready', async () => {
    const { listAttached } = await import('./devices');
    state.answers.push({ match: 'getprop', stdout: GETPROP });

    const { physical } = await listAttached(sdk);

    // An unauthorized device answers every shell command with an error, so asking is pure noise.
    expect(state.calls.filter((args) => args.join(' ').includes('2B141FDH2000XX'))).toHaveLength(0);
    expect(physical.find((d) => d.device.serial === '2B141FDH2000XX')).toMatchObject({
      androidVersion: null,
      api: null,
    });
  });

  it('keeps the model adb reported when getprop has no answer for it', async () => {
    const { listAttached } = await import('./devices');
    // A device that answers the version props but not the model. An empty string is an answer,
    // not a missing value, so a naive fallback would blank out a model we already knew.
    state.answers.push({
      match: 'getprop',
      stdout: [
        '[ro.build.version.release]: [14]',
        '[ro.build.version.sdk]: [34]',
        '[ro.product.model]: []',
        '',
      ].join('\n'),
    });

    const { physical } = await listAttached(sdk);
    const ready = physical.find((d) => d.device.serial === 'R58M20ABCDE');

    expect(ready?.device.model).toBe('SM A525F');
    expect(ready?.androidVersion).toBe('14');
  });

  it('keeps the device in the list when its properties cannot be read', async () => {
    const { listAttached } = await import('./devices');
    state.answers.push({ match: 'getprop', error: 'device offline' });

    const { physical } = await listAttached(sdk);

    // A failed probe must not drop a device the user can see plugged in.
    expect(physical).toHaveLength(2);
    expect(physical[0].androidVersion).toBeNull();
  });
});

describe('resolveAvdNames', () => {
  it('asks the emulator console which AVD each serial is', async () => {
    const { resolveAvdNames } = await import('./devices');
    state.answers.push({ match: '-s emulator-5554 emu avd name', stdout: 'Pixel_7_API_34\nOK\n' });

    const names = await resolveAvdNames(sdk, ['emulator-5554']);

    expect(names.get('emulator-5554')).toBe('Pixel_7_API_34');
  });

  it('leaves a serial unresolved rather than guessing when the console will not answer', async () => {
    const { resolveAvdNames } = await import('./devices');
    state.answers.push({ match: 'emu avd name', error: 'device offline' });

    const names = await resolveAvdNames(sdk, ['emulator-5556']);

    expect(names.has('emulator-5556')).toBe(false);
  });
});
