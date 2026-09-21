/**
 * Wireless debugging: the phone shows a host and a one-time pairing port on its own screen, and
 * the user types both in. That string goes straight onto an adb command line, so it is validated
 * here rather than escaped later. Anything that is not a plain host and port is refused outright.
 */

export interface HostPort {
  host: string;
  port: number;
  /** The normalized `host:port` to pass to adb. */
  hostPort: string;
}

export interface PairResult {
  ok: boolean;
  message?: string;
  hostPort?: string;
  guid?: string;
}

/** A hostname label set: letters, digits and dashes, dot separated. No shell metacharacters. */
const HOSTNAME =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*$/;

export function normalizeHostPort(input: string): HostPort | null {
  const text = input.trim();
  if (!text) return null;

  const separator = text.lastIndexOf(':');
  if (separator <= 0 || separator === text.length - 1) return null;

  const host = text.slice(0, separator).trim();
  const portText = text.slice(separator + 1).trim();

  if (!/^\d+$/.test(portText)) return null;
  const port = Number(portText);
  if (port < 1 || port > 65535) return null;

  if (!HOSTNAME.test(host)) return null;
  // A host that reads as a flag would be taken as one by adb.
  if (host.startsWith('-')) return null;

  return { host, port, hostPort: `${host}:${port}` };
}

export function parseAdbPairResult(output: string): PairResult {
  const text = output.trim();
  const success = /Successfully paired to ([^\s[]+)(?:\s*\[guid=([^\]]+)\])?/.exec(text);
  if (success) {
    return { ok: true, hostPort: success[1], guid: success[2] ?? undefined };
  }
  const failed = /^Failed:\s*(.*)$/m.exec(text);
  return { ok: false, message: failed ? failed[1].trim() : text || 'Pairing failed.' };
}

export function parseAdbConnectResult(output: string): PairResult {
  const text = output.trim();
  // "already connected" is the state the user wanted, so it is not an error.
  const connected = /^(?:already )?connected to (\S+)/im.exec(text);
  if (connected) return { ok: true, hostPort: connected[1] };
  return { ok: false, message: text || 'Could not connect.' };
}

/**
 * `adb shell ip route` on the device, used after `adb tcpip` to find the address to connect back
 * to. Only a wlan interface is trusted: rmnet and radio routes are the mobile network, which the
 * desktop cannot reach.
 */
export function parseDeviceIpFromIpRoute(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    if (!/\bdev\s+wlan\d*/.test(line)) continue;
    const src = /\bsrc\s+(\d{1,3}(?:\.\d{1,3}){3})/.exec(line);
    if (src) return src[1];
  }
  return null;
}
