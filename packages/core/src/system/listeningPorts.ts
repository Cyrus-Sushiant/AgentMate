/** A TCP port some process is accepting connections on. */
export interface ListeningSocket {
  pid: number;
  port: number;
}

function portOf(address: string): number | null {
  const colon = address.lastIndexOf(':');
  if (colon < 0) return null;
  const port = Number(address.slice(colon + 1));
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

function unique(sockets: ListeningSocket[]): ListeningSocket[] {
  const seen = new Set<string>();
  return sockets.filter((socket) => {
    const key = `${socket.pid}:${socket.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Windows `netstat -ano`. The state column is translated on non-English Windows, so a listening
 * row is told apart by its foreign address instead, which is always port 0 (`0.0.0.0:0`, `[::]:0`).
 */
export function parseNetstatListening(text: string): ListeningSocket[] {
  const sockets: ListeningSocket[] = [];
  for (const line of text.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 5 || fields[0].toUpperCase() !== 'TCP') continue;
    const foreign = fields[2];
    if (!foreign.endsWith(':0')) continue;
    const port = portOf(fields[1]);
    const pid = Number(fields.at(-1));
    if (port === null || !Number.isInteger(pid) || pid <= 0) continue;
    sockets.push({ pid, port });
  }
  return unique(sockets);
}

/** macOS `lsof -nP -iTCP -sTCP:LISTEN -F pn`: a `p<pid>` line, then `n<address>` lines. */
export function parseLsofListening(text: string): ListeningSocket[] {
  const sockets: ListeningSocket[] = [];
  let pid: number | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('p')) {
      const value = Number(line.slice(1));
      pid = Number.isInteger(value) && value > 0 ? value : null;
    } else if (line.startsWith('n') && pid !== null) {
      // A connected socket reads `local->remote`; only listening ones are asked for, but be safe.
      if (line.includes('->')) continue;
      const port = portOf(line.slice(1));
      if (port !== null) sockets.push({ pid, port });
    }
  }
  return unique(sockets);
}

/**
 * Linux `ss -ltnpH`. The pid list (`users:(("node",pid=1234,fd=20))`) only shows for processes
 * this user may inspect, which covers everything a terminal in the app started.
 */
export function parseSsListening(text: string): ListeningSocket[] {
  const sockets: ListeningSocket[] = [];
  for (const line of text.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 5) continue;
    const port = portOf(fields[3]);
    if (port === null) continue;
    for (const match of line.matchAll(/pid=(\d+)/g)) {
      sockets.push({ pid: Number(match[1]), port });
    }
  }
  return unique(sockets);
}
