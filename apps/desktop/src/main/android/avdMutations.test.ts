import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Creating, deleting and wiping an AVD.
 *
 * `avdmanager create avd` prompts on stdin even when `-d` is given, so the answer has to be
 * written or the call hangs forever. Wiping is done by deleting the data images directly, because
 * there is no avdmanager verb for it, which makes "only inside this AVD's folder" the thing to
 * be sure of.
 */

const state = vi.hoisted(() => ({
  calls: [] as { args: string[]; input?: string }[],
  answers: [] as { match: string; stdout?: string; error?: string }[],
  removed: [] as string[],
  files: new Map<string, string>(),
  existing: new Set<string>(),
  entries: new Map<string, string[]>(),
}));

vi.mock('./exec', () => ({
  AndroidCommandError: class extends Error {},
  AndroidToolMissingError: class extends Error {},
  runAvdManager: (_sdk: unknown, args: string[], options?: { input?: string }) => {
    state.calls.push({ args, input: options?.input });
    const line = args.join(' ');
    const answer = state.answers.find((a) => line.includes(a.match));
    if (answer?.error) return Promise.reject(new Error(answer.error));
    return Promise.resolve(answer?.stdout ?? '');
  },
  runSdkManager: (_sdk: unknown, args: string[]) => {
    state.calls.push({ args });
    const answer = state.answers.find((a) => args.join(' ').includes(a.match));
    if (answer?.error) return Promise.reject(new Error(answer.error));
    return Promise.resolve(answer?.stdout ?? '');
  },
}));

/** node:path joins with the host separator, so the virtual filesystem normalizes before looking. */
const norm = (p: unknown): string => String(p).replace(/\\/g, '/');

vi.mock('node:fs', () => ({
  existsSync: (p: string) => state.existing.has(norm(p)),
  readdirSync: (p: string) => state.entries.get(norm(p)) ?? [],
}));

vi.mock('node:fs/promises', () => ({
  rm: async (p: string) => {
    state.removed.push(norm(p));
  },
  readFile: async (p: string) => {
    const content = state.files.get(norm(p));
    if (content === undefined) throw new Error('ENOENT');
    return content;
  },
  writeFile: async (p: string, data: string) => {
    state.files.set(norm(p), String(data));
  },
}));

vi.mock('node:os', () => ({ homedir: () => '/home/dev', platform: () => 'linux' }));

const sdk = { paths: { avdmanager: '/sdk/avdmanager', sdkmanager: '/sdk/sdkmanager' } } as never;
const AVD_HOME = '/home/dev/.android/avd';

beforeEach(() => {
  state.calls.length = 0;
  state.answers.length = 0;
  state.removed.length = 0;
  state.files.clear();
  state.existing.clear();
  state.entries.clear();
  state.existing.add(AVD_HOME);
});

describe('createAvd', () => {
  it('builds the command from the spec and answers the hardware-profile prompt', async () => {
    const { createAvd } = await import('./avdMutations');
    state.answers.push({ match: 'create avd', stdout: '' });

    const result = await createAvd(sdk, {
      name: 'My_Pixel',
      systemImageId: 'system-images;android-34;google_apis;x86_64',
      device: 'pixel_7',
    });

    expect(result.ok).toBe(true);
    const call = state.calls[0];
    expect(call.args).toEqual([
      'create',
      'avd',
      '-n',
      'My_Pixel',
      '-k',
      'system-images;android-34;google_apis;x86_64',
      '-d',
      'pixel_7',
    ]);
    // Without this, avdmanager sits waiting on stdin and the call never returns.
    expect(call.input).toBe('no\n');
  });

  it('refuses a name avdmanager would reject, before spawning anything', async () => {
    const { createAvd } = await import('./avdMutations');

    const result = await createAvd(sdk, {
      name: 'My Pixel',
      systemImageId: 'system-images;android-34;google_apis;x86_64',
      device: 'pixel_7',
    });

    expect(result.ok).toBe(false);
    expect(state.calls).toHaveLength(0);
  });

  it('reports what avdmanager said when it fails', async () => {
    const { createAvd } = await import('./avdMutations');
    state.answers.push({ match: 'create avd', error: 'Package path is not valid' });

    const result = await createAvd(sdk, {
      name: 'Ok_Name',
      systemImageId: 'system-images;android-99;google_apis;x86_64',
      device: 'pixel_7',
    });

    expect(result).toMatchObject({ ok: false });
    expect(result.message).toContain('Package path is not valid');
  });
});

describe('deleteAvd', () => {
  it('deletes by name', async () => {
    const { deleteAvd } = await import('./avdMutations');
    state.answers.push({ match: 'delete avd', stdout: '' });

    const result = await deleteAvd(sdk, 'Pixel_7_API_34');

    expect(result.ok).toBe(true);
    expect(state.calls[0].args).toEqual(['delete', 'avd', '-n', 'Pixel_7_API_34']);
  });
});

describe('wipeAvdData', () => {
  it('removes only the data images inside that AVD folder', async () => {
    const { wipeAvdData } = await import('./avdMutations');
    const folder = `${AVD_HOME}/Pixel_7_API_34.avd`;
    state.existing.add(folder);
    state.entries.set(folder, [
      'userdata-qemu.img',
      'userdata-qemu.img.qcow2',
      'cache.img',
      'snapshots',
      'config.ini',
      'userdata.img',
    ]);

    const result = await wipeAvdData(sdk, 'Pixel_7_API_34');

    expect(result.ok).toBe(true);
    const names = state.removed.map((path) => path.slice(folder.length + 1));
    expect(names.sort()).toEqual(
      ['cache.img', 'snapshots', 'userdata-qemu.img', 'userdata-qemu.img.qcow2'].sort(),
    );
    // The definition of the AVD itself must survive a wipe.
    expect(names).not.toContain('config.ini');
    expect(names).not.toContain('userdata.img');
  });

  it('refuses a name that could point outside the AVD folder', async () => {
    const { wipeAvdData } = await import('./avdMutations');

    const result = await wipeAvdData(sdk, '../../etc');

    expect(result.ok).toBe(false);
    expect(state.removed).toEqual([]);
  });

  it('says so when the AVD folder is not there', async () => {
    const { wipeAvdData } = await import('./avdMutations');

    const result = await wipeAvdData(sdk, 'Missing_One');

    expect(result.ok).toBe(false);
    expect(state.removed).toEqual([]);
  });
});

describe('listSystemImages', () => {
  it('returns only the installed images, newest API first', async () => {
    const { listSystemImages } = await import('./avdMutations');
    state.answers.push({
      match: '--list_installed',
      stdout: [
        'Installed packages:',
        '  Path | Version | Description | Location',
        '  system-images;android-33;google_apis;x86_64 | 10 | Google APIs | x',
        '  system-images;android-34;google_apis;x86_64 | 12 | Google APIs | x',
        '  platform-tools | 35.0.1 | Platform-Tools | x',
        '',
      ].join('\n'),
    });

    const images = await listSystemImages(sdk);

    expect(images.map((image) => image.api)).toEqual([34, 33]);
  });

  it('comes back empty rather than throwing when sdkmanager will not run', async () => {
    const { listSystemImages } = await import('./avdMutations');
    state.answers.push({ match: '--list', error: 'no java' });

    await expect(listSystemImages(sdk)).resolves.toEqual([]);
  });
});

describe('listDeviceProfiles', () => {
  it('reads the compact id list', async () => {
    const { listDeviceProfiles } = await import('./avdMutations');
    state.answers.push({
      match: 'list device',
      stdout: 'pixel_7\npixel_tablet\nNexus 5\n',
    });

    const profiles = await listDeviceProfiles(sdk);

    expect(profiles).toEqual(['pixel_7', 'pixel_tablet', 'Nexus 5']);
  });

  it('falls back to a built-in list when avdmanager cannot answer', async () => {
    const { listDeviceProfiles } = await import('./avdMutations');
    state.answers.push({ match: 'list device', error: 'no java' });

    const profiles = await listDeviceProfiles(sdk);

    // An empty dropdown would make the dialog unusable, so there is always something to pick.
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles).toContain('pixel_7');
  });
});

describe('editAvd', () => {
  const folder = `${AVD_HOME}/Pixel_7_API_34.avd`;
  const config = [
    '# written by avdmanager',
    'avd.ini.displayname=Pixel 7 API 34',
    'hw.ramSize=2048',
    'image.sysdir.1=system-images/android-34/google_apis/x86_64/',
    '',
  ].join('\n');

  function seed(): void {
    state.existing.add(folder);
    state.files.set(`${folder}/config.ini`, config);
  }

  it('rewrites only the settings that changed', async () => {
    const { editAvd } = await import('./avdMutations');
    seed();

    const result = await editAvd(sdk, 'Pixel_7_API_34', { ramMb: 4096 });

    expect(result.ok).toBe(true);
    const written = state.files.get(`${folder}/config.ini`) ?? '';
    expect(written).toContain('hw.ramSize=4096');
    // The system image is not editable, so it has to survive untouched.
    expect(written).toContain('image.sysdir.1=system-images/android-34/google_apis/x86_64/');
    expect(written).toContain('# written by avdmanager');
  });

  it('renames the device without touching its id', async () => {
    const { editAvd } = await import('./avdMutations');
    seed();

    await editAvd(sdk, 'Pixel_7_API_34', { displayName: 'Work phone' });

    expect(state.files.get(`${folder}/config.ini`)).toContain('avd.ini.displayname=Work phone');
  });

  it('refuses a value that would leave the AVD unbootable, and writes nothing', async () => {
    const { editAvd } = await import('./avdMutations');
    seed();

    const result = await editAvd(sdk, 'Pixel_7_API_34', { ramMb: 16 });

    expect(result.ok).toBe(false);
    expect(state.files.get(`${folder}/config.ini`)).toBe(config);
  });

  it('refuses a name that could point outside the AVD folder', async () => {
    const { editAvd } = await import('./avdMutations');
    seed();

    const result = await editAvd(sdk, '../../etc', { ramMb: 4096 });

    expect(result.ok).toBe(false);
  });

  it('says so when the AVD has no config to edit', async () => {
    const { editAvd } = await import('./avdMutations');

    const result = await editAvd(sdk, 'Missing_One', { ramMb: 4096 });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/could not/i);
  });
});

describe('readAvdConfig', () => {
  const folder = `${AVD_HOME}/Pixel_7_API_34.avd`;

  it('reads the advanced settings back out of the file', async () => {
    const { readAvdConfig } = await import('./avdMutations');
    state.existing.add(folder);
    state.files.set(
      `${folder}/config.ini`,
      ['hw.cpu.ncore=4', 'sdcard.size=512M', 'hw.sdCard=yes', 'hw.keyboard=no', ''].join('\n'),
    );

    const config = await readAvdConfig(sdk, 'Pixel_7_API_34');

    expect(config).toMatchObject({ cores: 4, sdCardMb: 512, keyboard: false });
  });

  it('gives the emulator defaults when there is no config to read', async () => {
    const { readAvdConfig } = await import('./avdMutations');

    // A dialog that opened with nothing filled in would be worse than one showing the defaults
    // the emulator would use anyway.
    await expect(readAvdConfig(sdk, 'Missing_One')).resolves.toMatchObject({
      cores: 1,
      keyboard: true,
    });
  });

  it('refuses a name that could point outside the AVD folder', async () => {
    const { readAvdConfig } = await import('./avdMutations');

    await expect(readAvdConfig(sdk, '../../etc')).rejects.toThrow();
  });
});
