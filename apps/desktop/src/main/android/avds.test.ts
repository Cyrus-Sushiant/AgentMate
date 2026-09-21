import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Listing AVDs. `emulator -list-avds` plus each AVD's own config.ini is the fast path and needs
 * no Java; `avdmanager list avd` is the fallback and the only way to see AVDs that are broken.
 */

const state = vi.hoisted(() => ({
  files: new Map<string, string>(),
  dirs: new Map<string, string[]>(),
  answers: [] as { match: string; stdout?: string; error?: string }[],
  calls: [] as { tool: string; args: string[] }[],
}));

vi.mock('node:fs', () => ({
  existsSync: (p: string) => state.files.has(String(p)) || state.dirs.has(String(p)),
  readFileSync: (p: string) => {
    const content = state.files.get(String(p));
    if (content === undefined) throw new Error(`ENOENT ${p}`);
    return content;
  },
  readdirSync: (p: string) => state.dirs.get(String(p)) ?? [],
}));

vi.mock('node:os', () => ({ homedir: () => '/home/dev', platform: () => 'linux' }));

function answer(tool: string, args: string[]): Promise<string> {
  state.calls.push({ tool, args });
  const line = args.join(' ');
  const found = state.answers.find((a) => line.includes(a.match));
  if (found?.error) return Promise.reject(new Error(found.error));
  return Promise.resolve(found?.stdout ?? '');
}

vi.mock('./exec', () => ({
  AndroidCommandError: class extends Error {},
  AndroidToolMissingError: class extends Error {},
  runEmulator: (_sdk: unknown, args: string[]) => answer('emulator', args),
  runAvdManager: (_sdk: unknown, args: string[]) => answer('avdmanager', args),
}));

const AVD_HOME = '/home/dev/.android/avd';

const CONFIG = [
  'avd.ini.displayname=Pixel 7 API 34',
  'hw.device.name=pixel_7',
  'hw.ramSize=2048',
  'image.sysdir.1=system-images/android-34/google_apis/x86_64/',
  'disk.dataPartition.size=6442450944',
  'tag.id=google_apis',
  'abi.type=x86_64',
  '',
].join('\n');

const full = {
  paths: { emulator: '/sdk/emulator', avdmanager: '/sdk/cmdline-tools/x/avdmanager' },
};
const noJavaTools = { paths: { emulator: '/sdk/emulator', avdmanager: null } };

beforeEach(() => {
  state.files.clear();
  state.dirs.clear();
  state.answers.length = 0;
  state.calls.length = 0;
});

describe('listAvds', () => {
  it('reads each AVD from its own config.ini, without needing Java', async () => {
    const { listAvds } = await import('./avds');
    state.answers.push({ match: '-list-avds', stdout: 'Pixel_7_API_34\n' });
    state.dirs.set(AVD_HOME, ['Pixel_7_API_34.avd']);
    state.files.set(`${AVD_HOME}/Pixel_7_API_34.avd/config.ini`, CONFIG);

    const { avds } = await listAvds(noJavaTools as never);

    expect(avds).toHaveLength(1);
    expect(avds[0]).toMatchObject({
      name: 'Pixel_7_API_34',
      displayName: 'Pixel 7 API 34',
      api: 34,
      ramMb: 2048,
      abi: 'x86_64',
    });
    // avdmanager is not installed here and was never needed.
    expect(state.calls.filter((c) => c.tool === 'avdmanager')).toHaveLength(0);
  });

  it('still lists an AVD whose config.ini cannot be read', async () => {
    const { listAvds } = await import('./avds');
    state.answers.push({ match: '-list-avds', stdout: 'Mystery_AVD\n' });

    const { avds } = await listAvds(noJavaTools as never);

    // The emulator can start it even if we cannot describe it, so hiding it would be wrong.
    expect(avds).toHaveLength(1);
    expect(avds[0]).toMatchObject({ name: 'Mystery_AVD', displayName: 'Mystery_AVD', api: null });
  });

  it('falls back to avdmanager when the emulator lists nothing', async () => {
    const { listAvds } = await import('./avds');
    state.answers.push({ match: '-list-avds', error: 'no emulator' });
    state.answers.push({
      match: 'list avd',
      stdout: [
        'Available Android Virtual Devices:',
        '    Name: From_Avdmanager',
        '  Device: pixel_7 (Google)',
        '  Target: Google APIs',
        '          Based on: Android 14.0 ("U") Tag/ABI: google_apis/x86_64',
        '',
      ].join('\n'),
    });

    const { avds } = await listAvds(full as never);

    expect(avds.map((a) => a.name)).toEqual(['From_Avdmanager']);
    expect(avds[0].api).toBe(34);
  });

  it('reports the AVDs avdmanager could not load, so the page can say why one is missing', async () => {
    const { listAvds } = await import('./avds');
    state.answers.push({ match: '-list-avds', stdout: '' });
    state.answers.push({
      match: 'list avd',
      stdout: [
        'The following Android Virtual Devices could not be loaded:',
        '    Name: Broken_One',
        '   Error: Missing system image for Google APIs arm64-v8a.',
        '',
      ].join('\n'),
    });

    const { broken } = await listAvds(full as never);

    expect(broken).toEqual([
      { name: 'Broken_One', error: 'Missing system image for Google APIs arm64-v8a.' },
    ]);
  });

  it('says nothing is there rather than throwing when no tool can answer', async () => {
    const { listAvds } = await import('./avds');
    state.answers.push({ match: '-list-avds', error: 'no emulator' });
    state.answers.push({ match: 'list avd', error: 'no java' });

    await expect(listAvds(full as never)).resolves.toEqual({ avds: [], broken: [] });
  });
});
