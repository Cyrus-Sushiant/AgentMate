import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every Android tool is run by its absolute path with an argv array, never through a shell. That
 * is what keeps a Windows SDK under "C:\\Program Files" working without quoting, and what stops a
 * device serial or an AVD name from ever being parsed as anything but one argument.
 */

const state = vi.hoisted(() => ({
  calls: [] as { file: string; args: string[]; options: Record<string, unknown> }[],
  stdout: '',
  error: null as { message: string; stderr?: string } | null,
}));

vi.mock('node:child_process', () => {
  const custom = Symbol.for('nodejs.util.promisify.custom');
  const execFile = Object.assign(() => undefined, {
    [custom]: (file: string, args: string[], options: Record<string, unknown>) => {
      state.calls.push({ file, args, options });
      if (state.error) {
        return Promise.reject(Object.assign(new Error(state.error.message), state.error));
      }
      return Promise.resolve({ stdout: state.stdout, stderr: '' });
    },
  });
  return { execFile };
});

const SDK_ROOT = 'C:\\Program Files\\Android\\Sdk';

const sdk = {
  status: 'found' as const,
  root: SDK_ROOT,
  source: 'override' as const,
  checked: [SDK_ROOT],
  adbVersion: '35.0.1',
  tools: { adb: true, emulator: true, avdmanager: true, sdkmanager: true },
  paths: {
    adb: `${SDK_ROOT}\\platform-tools\\adb.exe`,
    emulator: `${SDK_ROOT}\\emulator\\emulator.exe`,
    avdmanager: `${SDK_ROOT}\\cmdline-tools\\latest\\bin\\avdmanager.bat`,
    sdkmanager: `${SDK_ROOT}\\cmdline-tools\\latest\\bin\\sdkmanager.bat`,
  },
};

const noTools = { ...sdk, paths: { ...sdk.paths, emulator: null } };

beforeEach(() => {
  state.calls.length = 0;
  state.stdout = '';
  state.error = null;
});

describe('runAdb', () => {
  it('runs the absolute adb, not a name resolved through PATH or a shell', async () => {
    const { runAdb } = await import('./exec');
    state.stdout = 'List of devices attached\n';

    await runAdb(sdk, ['devices', '-l']);

    expect(state.calls).toHaveLength(1);
    const [call] = state.calls;
    expect(call.file).toBe(sdk.paths.adb);
    expect(call.args).toEqual(['devices', '-l']);
    // A shell would reintroduce the quoting problem the absolute path avoids.
    expect(call.options.shell).toBeFalsy();
    expect(call.options.windowsHide).toBe(true);
  });

  it('passes a serial through as one argument whatever it contains', async () => {
    const { runAdb } = await import('./exec');

    await runAdb(sdk, ['-s', '192.168.1.20:5555', 'shell', 'getprop sys.boot_completed']);

    expect(state.calls[0].args).toContain('192.168.1.20:5555');
    expect(state.calls[0].args).toContain('getprop sys.boot_completed');
  });

  it('tells the tools where the SDK is, since they read it themselves', async () => {
    const { runAdb } = await import('./exec');

    await runAdb(sdk, ['devices']);

    const env = state.calls[0].options.env as Record<string, string>;
    expect(env.ANDROID_SDK_ROOT).toBe(SDK_ROOT);
    expect(env.ANDROID_HOME).toBe(SDK_ROOT);
  });

  it('takes a per-call timeout and defaults to a short one', async () => {
    const { runAdb } = await import('./exec');

    await runAdb(sdk, ['devices']);
    expect(state.calls[0].options.timeout).toBeGreaterThan(0);

    await runAdb(sdk, ['install', 'big.apk'], { timeoutMs: 600_000 });
    expect(state.calls[1].options.timeout).toBe(600_000);
  });
});

describe('runAvdManager and runSdkManager', () => {
  it('gives both more room, since each has to start a JVM first', async () => {
    const { runAvdManager, runSdkManager } = await import('./exec');

    await runAvdManager(sdk, ['list', 'avd']);
    await runSdkManager(sdk, ['--list_installed']);

    expect(state.calls[0].options.timeout as number).toBeGreaterThanOrEqual(30_000);
    // Whichever way they are spawned, the tool that ran is identifiable from the call.
    const first = [state.calls[0].file, ...state.calls[0].args].join(' ');
    const second = [state.calls[1].file, ...state.calls[1].args].join(' ');
    expect(first).toContain('avdmanager');
    expect(second).toContain('sdkmanager');
  });
});

describe('when a tool is not installed', () => {
  it('throws before spawning anything, naming the package to install', async () => {
    const { runEmulator, AndroidToolMissingError } = await import('./exec');

    await expect(runEmulator(noTools, ['-list-avds'])).rejects.toBeInstanceOf(
      AndroidToolMissingError,
    );
    expect(state.calls).toHaveLength(0);
  });
});

describe('when a tool fails', () => {
  it('surfaces what the tool printed on stderr rather than a bare exit code', async () => {
    const { runAdb, AndroidCommandError } = await import('./exec');
    state.error = { message: 'Command failed', stderr: 'adb: device offline' };

    const failure = await runAdb(sdk, ['devices']).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AndroidCommandError);
    expect((failure as Error).message).toContain('device offline');
  });

  it('explains the Java error avdmanager gives when no runtime is on the machine', async () => {
    const { runAvdManager } = await import('./exec');
    state.error = {
      message: 'Command failed',
      stderr: "ERROR: JAVA_HOME is not set and no 'java' command could be found",
    };

    const failure = await runAvdManager(sdk, ['list', 'avd']).catch((error: unknown) => error);

    // The raw message points at JAVA_HOME, which does not tell an Android user what to do.
    expect((failure as Error).message).toMatch(/Java/i);
    expect((failure as Error).message).toMatch(/jbr|Android Studio/i);
  });
});

describe('a Windows batch tool', () => {
  it('routes a .bat through cmd.exe, since Node refuses to spawn one directly', async () => {
    // avdmanager and sdkmanager ship as .bat on Windows. Since the Node 20 security fix,
    // execFile on a .bat or .cmd throws EINVAL unless it goes through a shell, so these two
    // cannot take the same direct path adb and the emulator do.
    const { runAvdManager } = await import('./exec');

    await runAvdManager(sdk, ['list', 'avd']);

    const [call] = state.calls;
    if (process.platform === 'win32') {
      expect(call.file.toLowerCase()).toContain('cmd.exe');
      expect(call.options.windowsVerbatimArguments).toBe(true);
      // The whole command line is one argument to cmd, with the tool path quoted because an SDK
      // under "C:\Program Files" is the common case.
      const line = call.args.join(' ');
      expect(line).toContain(`"${sdk.paths.avdmanager}"`);
      expect(line).toContain('list');
      expect(line).toContain('avd');
    } else {
      // Nothing to work around off Windows.
      expect(call.file).toBe(sdk.paths.avdmanager);
      expect(call.args).toEqual(['list', 'avd']);
    }
  });

  it('still runs adb directly, because it is a real executable', async () => {
    const { runAdb } = await import('./exec');

    await runAdb(sdk, ['devices']);

    expect(state.calls[0].file).toBe(sdk.paths.adb);
    expect(state.calls[0].args).toEqual(['devices']);
  });
});
