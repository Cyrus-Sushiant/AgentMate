import { describe, expect, it } from 'vitest';
import {
  avdHomeCandidates,
  isPlausibleSdkRoot,
  resolveSdkRoot,
  sdkBinaryPaths,
} from './sdkPaths.js';

/** A virtual filesystem: every listed path exists, nothing else does. Separators are normalized
 * so a test can write the Windows layout with forward slashes and stay readable. */
const fs = (...paths: string[]) => {
  const norm = (p: string): string => p.replace(/\\/g, '/');
  const set = new Set(paths.map(norm));
  return (p: string): boolean => set.has(norm(p));
};

const WIN_SDK = 'C:\\Users\\dev\\AppData\\Local\\Android\\Sdk';
const MAC_SDK = '/Users/dev/Library/Android/sdk';
const LIN_SDK = '/home/dev/Android/Sdk';

describe('isPlausibleSdkRoot', () => {
  it('needs the folder plus one known subfolder', () => {
    expect(isPlausibleSdkRoot(LIN_SDK, fs(LIN_SDK, `${LIN_SDK}/platform-tools`))).toBe(true);
    expect(isPlausibleSdkRoot(LIN_SDK, fs(LIN_SDK, `${LIN_SDK}/emulator`))).toBe(true);
    expect(isPlausibleSdkRoot(LIN_SDK, fs(LIN_SDK, `${LIN_SDK}/cmdline-tools`))).toBe(true);
    // An empty folder is not an SDK.
    expect(isPlausibleSdkRoot(LIN_SDK, fs(LIN_SDK))).toBe(false);
    expect(isPlausibleSdkRoot(LIN_SDK, fs())).toBe(false);
  });
});

describe('resolveSdkRoot', () => {
  it('prefers the settings override', () => {
    const result = resolveSdkRoot({
      override: MAC_SDK,
      env: { ANDROID_HOME: '/somewhere/else' },
      platform: 'darwin',
      homeDir: '/Users/dev',
      exists: fs(
        MAC_SDK,
        `${MAC_SDK}/platform-tools`,
        '/somewhere/else',
        '/somewhere/else/emulator',
      ),
    });
    expect(result).toMatchObject({ status: 'found', root: MAC_SDK, source: 'override' });
  });

  it('reports an override that is not an SDK instead of falling through to the env', () => {
    // Silently ignoring a wrong override is worse than saying so: the user set it on purpose.
    const result = resolveSdkRoot({
      override: '/Users/dev/Downloads',
      env: { ANDROID_HOME: MAC_SDK },
      platform: 'darwin',
      homeDir: '/Users/dev',
      exists: fs('/Users/dev/Downloads', MAC_SDK, `${MAC_SDK}/platform-tools`),
    });
    expect(result.status).toBe('override-invalid');
    expect(result.root).toBe('/Users/dev/Downloads');
  });

  it('falls back through ANDROID_HOME then ANDROID_SDK_ROOT then the per-OS defaults', () => {
    const base = { override: null, platform: 'linux' as const, homeDir: '/home/dev' };
    expect(
      resolveSdkRoot({
        ...base,
        env: { ANDROID_HOME: LIN_SDK, ANDROID_SDK_ROOT: '/opt/android-sdk' },
        exists: fs(
          LIN_SDK,
          `${LIN_SDK}/platform-tools`,
          '/opt/android-sdk',
          '/opt/android-sdk/platform-tools',
        ),
      }),
    ).toMatchObject({ root: LIN_SDK, source: 'ANDROID_HOME' });

    expect(
      resolveSdkRoot({
        ...base,
        env: { ANDROID_SDK_ROOT: '/opt/android-sdk' },
        exists: fs('/opt/android-sdk', '/opt/android-sdk/platform-tools'),
      }),
    ).toMatchObject({ root: '/opt/android-sdk', source: 'ANDROID_SDK_ROOT' });

    expect(
      resolveSdkRoot({ ...base, env: {}, exists: fs(LIN_SDK, `${LIN_SDK}/emulator`) }),
    ).toMatchObject({ root: LIN_SDK, source: 'default' });
  });

  it('finds the usual install per platform', () => {
    expect(
      resolveSdkRoot({
        override: null,
        env: {},
        platform: 'win32',
        homeDir: 'C:\\Users\\dev',
        exists: fs(WIN_SDK, `${WIN_SDK}\\platform-tools`),
      }),
    ).toMatchObject({ root: WIN_SDK });

    expect(
      resolveSdkRoot({
        override: null,
        env: {},
        platform: 'darwin',
        homeDir: '/Users/dev',
        exists: fs(MAC_SDK, `${MAC_SDK}/platform-tools`),
      }),
    ).toMatchObject({ root: MAC_SDK });
  });

  it('reports every path it looked at when nothing is found', () => {
    const result = resolveSdkRoot({
      override: null,
      env: {},
      platform: 'linux',
      homeDir: '/home/dev',
      exists: fs(),
    });
    expect(result.status).toBe('missing');
    expect(result.root).toBeNull();
    // The UI lists these so a failed detection is debuggable rather than a dead end.
    expect(result.checked.length).toBeGreaterThan(2);
    expect(result.checked).toContain(LIN_SDK);
  });
});

describe('sdkBinaryPaths', () => {
  it('adds .exe and .bat only on Windows, and joins with the platform separator', () => {
    const win = sdkBinaryPaths(
      WIN_SDK,
      'win32',
      fs(
        `${WIN_SDK}/platform-tools/adb.exe`,
        `${WIN_SDK}/emulator/emulator.exe`,
        `${WIN_SDK}/cmdline-tools/latest/bin/avdmanager.bat`,
        `${WIN_SDK}/cmdline-tools/latest/bin/sdkmanager.bat`,
      ),
    );
    expect(win.adb).toBe(`${WIN_SDK}\\platform-tools\\adb.exe`);
    expect(win.avdmanager).toBe(`${WIN_SDK}\\cmdline-tools\\latest\\bin\\avdmanager.bat`);

    const mac = sdkBinaryPaths(
      MAC_SDK,
      'darwin',
      fs(`${MAC_SDK}/platform-tools/adb`, `${MAC_SDK}/emulator/emulator`),
    );
    expect(mac.adb).toBe(`${MAC_SDK}/platform-tools/adb`);
    expect(mac.emulator).toBe(`${MAC_SDK}/emulator/emulator`);
  });

  it('reports a tool that is not installed as null rather than guessing a path', () => {
    const paths = sdkBinaryPaths(LIN_SDK, 'linux', fs(`${LIN_SDK}/platform-tools/adb`));
    expect(paths.adb).not.toBeNull();
    expect(paths.emulator).toBeNull();
    expect(paths.avdmanager).toBeNull();
  });

  it('prefers cmdline-tools over the legacy tools/bin', () => {
    const legacy = sdkBinaryPaths(LIN_SDK, 'linux', fs(`${LIN_SDK}/tools/bin/avdmanager`));
    expect(legacy.avdmanager).toBe(`${LIN_SDK}/tools/bin/avdmanager`);

    const latest = sdkBinaryPaths(
      LIN_SDK,
      'linux',
      fs(`${LIN_SDK}/cmdline-tools/latest/bin/avdmanager`, `${LIN_SDK}/tools/bin/avdmanager`),
    );
    expect(latest.avdmanager).toBe(`${LIN_SDK}/cmdline-tools/latest/bin/avdmanager`);
  });

  it('accepts a .bat or .cmd wrapper on Windows when there is no .exe', () => {
    // Some installs wrap adb in a script rather than shipping the executable directly, and the
    // e2e suite's fake SDK does the same. The .exe still wins when both are present.
    const WIN = 'C:\\Sdk';
    const wrapped = sdkBinaryPaths(WIN, 'win32', fs(`${WIN}/platform-tools/adb.bat`));
    expect(wrapped.adb).toBe(`${WIN}\\platform-tools\\adb.bat`);

    const both = sdkBinaryPaths(
      WIN,
      'win32',
      fs(`${WIN}/platform-tools/adb.exe`, `${WIN}/platform-tools/adb.bat`),
    );
    expect(both.adb).toBe(`${WIN}\\platform-tools\\adb.exe`);
  });

  it('falls back to the emulator that older SDKs kept under tools/', () => {
    const paths = sdkBinaryPaths(LIN_SDK, 'linux', fs(`${LIN_SDK}/tools/emulator`));
    expect(paths.emulator).toBe(`${LIN_SDK}/tools/emulator`);
  });
});

describe('avdHomeCandidates', () => {
  it('puts ANDROID_AVD_HOME first and always offers ~/.android/avd', () => {
    const withEnv = avdHomeCandidates({ ANDROID_AVD_HOME: '/custom/avd' }, '/home/dev');
    expect(withEnv[0]).toBe('/custom/avd');
    expect(avdHomeCandidates({}, '/home/dev')).toContain('/home/dev/.android/avd');
  });
});
