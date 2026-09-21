import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * A fake Android SDK, so the Android page can be driven end to end on a machine (and a CI runner)
 * that has no Android tooling at all.
 *
 * This is the same trick `writeFakeClaude` in app.ts already uses for the Claude CLI, and it is
 * deliberately preferred over stubbing the IPC handlers: the parts most likely to break are SDK
 * path resolution, spawning tools by absolute path, and the exact argv sent, and only a real tree
 * with real executables exercises any of that.
 *
 * Each shim is a Node script that appends its argv to a log and answers from a JSON state file
 * the test rewrites between steps, so a boot sequence can be driven deterministically.
 */

/** The state a test hands the shims, rewritten between steps. */
export interface FakeSdkState {
  /** AVD ids `emulator -list-avds` reports. */
  avds: string[];
  /** Rows `adb devices -l` reports. */
  devices: { serial: string; state: string; model?: string }[];
  /** Serial to AVD name, for `adb -s S emu avd name`. */
  avdBySerial: Record<string, string>;
  /** Properties `getprop` answers with, per serial. */
  props: Record<string, Record<string, string>>;
  /** What `sdkmanager --list_installed` reports. */
  systemImages: string[];
}

export const DEFAULT_STATE: FakeSdkState = {
  avds: ['Pixel_7_API_34'],
  devices: [],
  avdBySerial: {},
  props: {},
  systemImages: ['system-images;android-34;google_apis;x86_64'],
};

const FAKE_ADB = `
const fs = require('node:fs');
const args = process.argv.slice(2);
const statePath = process.env.FAKE_SDK_STATE;
const logPath = process.env.FAKE_SDK_LOG;
fs.appendFileSync(logPath, JSON.stringify(args) + '\\n');
const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

// A -s SERIAL prefix, stripped so the verb is always at the front.
let serial = null;
let rest = args;
if (rest[0] === '-s') { serial = rest[1]; rest = rest.slice(2); }
const verb = rest[0];

if (verb === 'version') {
  console.log('Android Debug Bridge version 1.0.41');
  console.log('Version 35.0.1-fake');
  process.exit(0);
}
if (verb === 'devices') {
  console.log('List of devices attached');
  for (const d of state.devices) {
    const model = d.model ? ' model:' + d.model.replace(/ /g, '_') : '';
    console.log(d.serial + '          ' + d.state + model + ' transport_id:1');
  }
  process.exit(0);
}
if (verb === 'emu' && rest[1] === 'avd' && rest[2] === 'name') {
  const name = state.avdBySerial[serial];
  if (!name) { console.log('KO: unknown'); process.exit(0); }
  console.log(name);
  console.log('OK');
  process.exit(0);
}
if (verb === 'emu' && rest[1] === 'kill') {
  state.devices = state.devices.filter((d) => d.serial !== serial);
  delete state.avdBySerial[serial];
  fs.writeFileSync(statePath, JSON.stringify(state));
  console.log('OK');
  process.exit(0);
}
if (verb === 'shell' && rest[1] === 'getprop') {
  const props = state.props[serial] || {};
  const names = rest.slice(2);
  if (names.length === 1) { console.log(props[names[0]] || ''); process.exit(0); }
  for (const name of names) console.log('[' + name + ']: [' + (props[name] || '') + ']');
  process.exit(0);
}
if (verb === 'pair') { console.log('Successfully paired to ' + rest[1]); process.exit(0); }
if (verb === 'connect') { console.log('connected to ' + rest[1]); process.exit(0); }
if (verb === 'install' || verb === 'install-multiple') {
  console.log('Performing Streamed Install');
  console.log('Success');
  process.exit(0);
}
process.exit(0);
`;

const FAKE_EMULATOR = `
const fs = require('node:fs');
const args = process.argv.slice(2);
const statePath = process.env.FAKE_SDK_STATE;
fs.appendFileSync(process.env.FAKE_SDK_LOG, JSON.stringify(args) + '\\n');
const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

if (args[0] === '-list-avds') {
  for (const name of state.avds) console.log(name);
  process.exit(0);
}
if (args[0] === '-avd') {
  // Brings the device up the way a real emulator would, then stays alive until it is killed.
  const name = args[1];
  const port = args[args.indexOf('-port') + 1];
  const serial = 'emulator-' + port;
  const current = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  current.devices.push({ serial, state: 'device', model: name });
  current.avdBySerial[serial] = name;
  current.props[serial] = { 'sys.boot_completed': '1', 'init.svc.bootanim': 'stopped' };
  fs.writeFileSync(statePath, JSON.stringify(current));
  // Stays alive the way a real emulator does, and goes away when its serial leaves the device
  // list, which is what \`adb emu kill\` does to the state. Without this the process outlives the
  // test and hangs Playwright's worker teardown.
  setInterval(() => {
    try {
      const now = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      if (!now.devices.some((d) => d.serial === serial)) process.exit(0);
    } catch (error) {
      // The temp folder went with the test; nothing left to run for.
      process.exit(0);
    }
  }, 250);
} else {
  process.exit(0);
}
`;

const FAKE_AVDMANAGER = `
const fs = require('node:fs');
const args = process.argv.slice(2);
const statePath = process.env.FAKE_SDK_STATE;
fs.appendFileSync(process.env.FAKE_SDK_LOG, JSON.stringify(args) + '\\n');
const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

if (args[0] === 'list' && args[1] === 'device') {
  console.log('pixel_7');
  console.log('pixel_tablet');
  process.exit(0);
}
if (args[0] === 'create' && args[1] === 'avd') {
  // The real one reads stdin even with -d, so draining it is part of behaving like it.
  const name = args[args.indexOf('-n') + 1];
  state.avds.push(name);
  fs.writeFileSync(statePath, JSON.stringify(state));
  process.stdin.resume();
  process.stdin.on('data', () => {});
  process.stdin.on('end', () => process.exit(0));
  setTimeout(() => process.exit(0), 200);
} else if (args[0] === 'delete' && args[1] === 'avd') {
  const name = args[args.indexOf('-n') + 1];
  state.avds = state.avds.filter((a) => a !== name);
  fs.writeFileSync(statePath, JSON.stringify(state));
  process.exit(0);
} else {
  console.log('Available Android Virtual Devices:');
  process.exit(0);
}
`;

const FAKE_SDKMANAGER = `
const fs = require('node:fs');
fs.appendFileSync(process.env.FAKE_SDK_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
const state = JSON.parse(fs.readFileSync(process.env.FAKE_SDK_STATE, 'utf-8'));
console.log('Installed packages:');
console.log('  Path | Version | Description | Location');
console.log('  ------- | ------- | ------- | -------');
for (const id of state.systemImages) console.log('  ' + id + ' | 12 | Google APIs | x');
process.exit(0);
`;

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** A .cmd on Windows, a shell script elsewhere, both handing off to the Node script beside them. */
function shim(binPath: string, scriptPath: string): void {
  if (process.platform === 'win32') {
    // A batch file, not a .exe: it is the only thing a test can write that Windows will run, and
    // the resolver accepts a .bat wrapper for exactly this reason. The main process routes batch
    // tools through cmd.exe, so this exercises that path too.
    write(`${binPath}.bat`, `@node "${scriptPath}" %*\r\n`);
    return;
  }
  write(binPath, `#!/bin/sh\nexec node "${scriptPath}" "$@"\n`);
  chmodSync(binPath, 0o755);
}

export interface FakeSdk {
  root: string;
  statePath: string;
  /** Replaces the state the shims answer from. */
  setState(next: Partial<FakeSdkState>): void;
  readState(): FakeSdkState;
  /** Every argv the shims were called with, in order. */
  calls(): string[][];
  /** True when some call's argv joined by a space contains this text. */
  sawCall(text: string): boolean;
}

/**
 * Builds the SDK under `root`. The folder deliberately has a space in its name, so the Windows
 * "C:\\Program Files" case is exercised on every run rather than only in production.
 */
export function writeFakeAndroidSdk(root: string): FakeSdk {
  const sdkRoot = join(root, 'Android Sdk');
  const scripts = join(sdkRoot, 'fake-scripts');
  const statePath = join(root, 'android-state.json');
  const logPath = join(root, 'android-calls.log');

  write(join(scripts, 'adb.js'), FAKE_ADB);
  write(join(scripts, 'emulator.js'), FAKE_EMULATOR);
  write(join(scripts, 'avdmanager.js'), FAKE_AVDMANAGER);
  write(join(scripts, 'sdkmanager.js'), FAKE_SDKMANAGER);

  shim(join(sdkRoot, 'platform-tools', 'adb'), join(scripts, 'adb.js'));
  shim(join(sdkRoot, 'emulator', 'emulator'), join(scripts, 'emulator.js'));
  shim(
    join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'avdmanager'),
    join(scripts, 'avdmanager.js'),
  );
  shim(
    join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'sdkmanager'),
    join(scripts, 'sdkmanager.js'),
  );

  writeFileSync(statePath, JSON.stringify(DEFAULT_STATE));
  writeFileSync(logPath, '');

  return {
    root: sdkRoot,
    statePath,
    setState: (next) => {
      const current = JSON.parse(readFileSync(statePath, 'utf-8')) as FakeSdkState;
      writeFileSync(statePath, JSON.stringify({ ...current, ...next }));
    },
    readState: () => JSON.parse(readFileSync(statePath, 'utf-8')) as FakeSdkState,
    calls: () =>
      existsSync(logPath)
        ? readFileSync(logPath, 'utf-8')
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => JSON.parse(line) as string[])
        : [],
    sawCall: (text) => {
      const lines = existsSync(logPath) ? readFileSync(logPath, 'utf-8') : '';
      return lines
        .split(/\r?\n/)
        .filter(Boolean)
        .some((line) => (JSON.parse(line) as string[]).join(' ').includes(text));
    },
  };
}

/** The env the app needs so the shims find their state and log. */
export function fakeSdkEnv(root: string): Record<string, string> {
  return {
    FAKE_SDK_STATE: join(root, 'android-state.json'),
    FAKE_SDK_LOG: join(root, 'android-calls.log'),
  };
}
