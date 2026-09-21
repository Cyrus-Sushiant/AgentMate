import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * SDK detection is the gate everything else sits behind, so what matters here is that the
 * settings override wins, that a wrong override is reported rather than skipped, that the cache
 * does not outlive a settings change, and that a partial SDK reports per-tool availability
 * instead of collapsing to "missing".
 */

const state = vi.hoisted(() => ({
  /** Paths that exist in this test, forward-slashed. */
  existing: new Set<string>(),
  settings: { androidSdkPath: null as string | null },
  env: {} as Record<string, string | undefined>,
  adbVersionOutput: 'Android Debug Bridge version 1.0.41\nVersion 35.0.1-12345\n',
  adbVersionFails: false,
  execCalls: [] as { file: string; args: string[] }[],
}));

vi.mock('node:fs', () => ({
  existsSync: (p: string) => state.existing.has(String(p).replace(/\\/g, '/')),
}));

vi.mock('node:os', () => ({
  homedir: () => '/home/dev',
  platform: () => 'linux',
}));

vi.mock('../store', () => ({
  store: { getSettings: async () => state.settings },
}));

vi.mock('node:child_process', () => {
  const custom = Symbol.for('nodejs.util.promisify.custom');
  const execFile = Object.assign(() => undefined, {
    [custom]: (file: string, args: string[]) => {
      state.execCalls.push({ file, args });
      if (state.adbVersionFails) return Promise.reject(new Error('spawn ENOENT'));
      return Promise.resolve({ stdout: state.adbVersionOutput, stderr: '' });
    },
  });
  return { execFile };
});

const SDK = '/home/dev/Android/Sdk';

function seedFullSdk(root = SDK): void {
  for (const path of [
    root,
    `${root}/platform-tools`,
    `${root}/platform-tools/adb`,
    `${root}/emulator`,
    `${root}/emulator/emulator`,
    `${root}/cmdline-tools`,
    `${root}/cmdline-tools/latest/bin/avdmanager`,
    `${root}/cmdline-tools/latest/bin/sdkmanager`,
  ]) {
    state.existing.add(path);
  }
}

async function load() {
  vi.resetModules();
  return import('./sdk');
}

beforeEach(() => {
  state.existing.clear();
  state.settings = { androidSdkPath: null };
  state.env = {};
  state.adbVersionFails = false;
  state.execCalls.length = 0;
});

describe('getAndroidSdk', () => {
  it('reports every tool when the SDK is complete', async () => {
    seedFullSdk();
    const { getAndroidSdk } = await load();

    const sdk = await getAndroidSdk(state.env);

    expect(sdk.status).toBe('found');
    expect(sdk.root).toBe(SDK);
    expect(sdk.tools).toEqual({
      adb: true,
      emulator: true,
      avdmanager: true,
      sdkmanager: true,
    });
    expect(sdk.adbVersion).toBe('35.0.1');
  });

  it('prefers the settings override over the environment', async () => {
    seedFullSdk();
    seedFullSdk('/opt/custom-sdk');
    state.settings.androidSdkPath = '/opt/custom-sdk';
    state.env.ANDROID_HOME = SDK;
    const { getAndroidSdk } = await load();

    expect(await getAndroidSdk(state.env)).toMatchObject({
      root: '/opt/custom-sdk',
      source: 'override',
    });
  });

  it('reports an override that is not an SDK instead of falling back', async () => {
    seedFullSdk();
    state.existing.add('/home/dev/Downloads');
    state.settings.androidSdkPath = '/home/dev/Downloads';
    const { getAndroidSdk } = await load();

    const sdk = await getAndroidSdk(state.env);

    expect(sdk.status).toBe('override-invalid');
    expect(sdk.tools.adb).toBe(false);
  });

  it('keeps working with only platform-tools, so physical devices still list', async () => {
    for (const path of [SDK, `${SDK}/platform-tools`, `${SDK}/platform-tools/adb`]) {
      state.existing.add(path);
    }
    const { getAndroidSdk } = await load();

    const sdk = await getAndroidSdk(state.env);

    expect(sdk.status).toBe('found');
    expect(sdk.tools).toMatchObject({ adb: true, emulator: false, avdmanager: false });
  });

  it('reports the paths it checked when nothing is installed', async () => {
    const { getAndroidSdk } = await load();

    const sdk = await getAndroidSdk(state.env);

    expect(sdk.status).toBe('missing');
    expect(sdk.checked.length).toBeGreaterThan(0);
    expect(sdk.adbVersion).toBeNull();
    // Nothing to run, so adb is never spawned.
    expect(state.execCalls).toHaveLength(0);
  });

  it('survives an adb that will not run', async () => {
    seedFullSdk();
    state.adbVersionFails = true;
    const { getAndroidSdk } = await load();

    const sdk = await getAndroidSdk(state.env);

    // The binary is on disk, so the tool is present even though the probe failed.
    expect(sdk.tools.adb).toBe(true);
    expect(sdk.adbVersion).toBeNull();
  });

  it('caches the answer and drops the cache when the SDK path changes', async () => {
    seedFullSdk();
    const { getAndroidSdk, refreshAndroidSdk } = await load();

    await getAndroidSdk(state.env);
    await getAndroidSdk(state.env);
    // The version probe is the only spawn, and the second read came from the cache.
    expect(state.execCalls).toHaveLength(1);

    refreshAndroidSdk();
    await getAndroidSdk(state.env);
    expect(state.execCalls).toHaveLength(2);
  });
});

describe('requireTool', () => {
  it('names the package that installs a missing tool', async () => {
    for (const path of [SDK, `${SDK}/platform-tools`, `${SDK}/platform-tools/adb`]) {
      state.existing.add(path);
    }
    const { getAndroidSdk, requireTool } = await load();
    const sdk = await getAndroidSdk(state.env);

    expect(requireTool(sdk, 'adb')).toBe(`${SDK}/platform-tools/adb`);
    expect(() => requireTool(sdk, 'emulator')).toThrow(/emulator/);
  });
});
