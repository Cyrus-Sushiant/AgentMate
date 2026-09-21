/**
 * `adb devices -l` is the only list of what is attached, and it mixes emulators, USB phones and
 * wireless ones in a single table whose columns are whitespace-aligned rather than delimited.
 */

export type AdbDeviceState = 'device' | 'offline' | 'unauthorized' | 'bootloader' | 'unknown';

/** How the device is attached, which decides what actions a card can offer. */
export type AdbTransport = 'emulator' | 'usb' | 'wifi';

export interface AdbDevice {
  serial: string;
  state: AdbDeviceState;
  kind: AdbTransport;
  /** The `model:` tail, underscores turned back into spaces for display. Null when adb omits it. */
  model: string | null;
  product: string | null;
  device: string | null;
  transportId: string | null;
}

const EMULATOR_SERIAL = /^emulator-(\d+)$/;
/** An IPv4 or bracketed IPv6 host with a port, which is how a wireless device reports itself. */
const HOST_PORT_SERIAL = /^(?:\[[0-9a-fA-F:]+\]|\d{1,3}(?:\.\d{1,3}){3}):\d+$/;

const KNOWN_STATES = new Set<AdbDeviceState>(['device', 'offline', 'unauthorized', 'bootloader']);

export function isEmulatorSerial(serial: string): boolean {
  return EMULATOR_SERIAL.test(serial);
}

/** The emulator's console port, which is also how `-port N` fixes the serial in advance. */
export function consolePortFromSerial(serial: string): number | null {
  const match = EMULATOR_SERIAL.exec(serial);
  return match ? Number(match[1]) : null;
}

function transportFor(serial: string): AdbTransport {
  if (isEmulatorSerial(serial)) return 'emulator';
  return HOST_PORT_SERIAL.test(serial) ? 'wifi' : 'usb';
}

export function parseAdbDevices(stdout: string): AdbDevice[] {
  const devices: AdbDevice[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    // The daemon banner and the table header both precede the rows and neither is a device.
    if (!line || line.startsWith('*') || line.startsWith('List of devices')) continue;

    const [serial, state, ...rest] = line.split(/\s+/);
    if (!serial || !state) continue;

    const tail: Record<string, string> = {};
    for (const part of rest) {
      const colon = part.indexOf(':');
      if (colon > 0) tail[part.slice(0, colon)] = part.slice(colon + 1);
    }

    devices.push({
      serial,
      state: KNOWN_STATES.has(state as AdbDeviceState) ? (state as AdbDeviceState) : 'unknown',
      kind: transportFor(serial),
      // adb reports the model with underscores where the marketing name has spaces.
      model: tail.model ? tail.model.replace(/_/g, ' ') : null,
      product: tail.product ?? null,
      device: tail.device ?? null,
      transportId: tail.transport_id ?? null,
    });
  }
  return devices;
}

/**
 * `getprop` with names prints `[name]: [value]` lines; `getprop one.name` prints the bare value.
 * A bare value comes back under `value` so callers can read a single probe without a special case.
 */
export function parseGetProp(stdout: string): Record<string, string> {
  const props: Record<string, string> = {};
  let matched = false;
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\[([^\]]+)\]:\s*\[(.*)\]$/.exec(line.trim());
    if (!match) continue;
    props[match[1]] = match[2];
    matched = true;
  }
  if (matched) return props;
  const bare = stdout.trim();
  return bare ? { value: bare } : {};
}
