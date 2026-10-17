import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFile = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFile }));

import { pingHost, probeAll } from './pingProbe';

const MAC_REPLY = [
  'PING 1.1.1.1 (1.1.1.1): 56 data bytes',
  '64 bytes from 1.1.1.1: icmp_seq=0 ttl=57 time=14.623 ms',
  '',
  '--- 1.1.1.1 ping statistics ---',
  '1 packets transmitted, 1 packets received, 0.0% packet loss',
  'round-trip min/avg/max/stddev = 14.623/14.623/14.623/0.000 ms',
].join('\n');

type Callback = (error: Error | null, result?: { stdout: string; stderr: string }) => void;

/** Stands in for macOS ping: it only answers when given at least a second to wait. */
function fakeMacPing(file: string, args: string[], _options: unknown, callback: Callback): void {
  const wait = args.indexOf('-W');
  const waitMs = wait >= 0 ? Number(args[wait + 1]) : 10_000;
  if (!file.endsWith('ping') && !file.endsWith('ping6')) {
    callback(Object.assign(new Error(`spawn ${file} ENOENT`), { code: 'ENOENT' }));
  } else if (args.includes('-6')) {
    callback(new Error('ping: invalid option -- 6'));
  } else if (waitMs < 1000) {
    callback(Object.assign(new Error('Command failed'), { code: 2 }));
  } else {
    callback(null, { stdout: MAC_REPLY, stderr: '' });
  }
}

describe('pingHost on macOS', () => {
  beforeEach(() => {
    execFile.mockReset();
    execFile.mockImplementation(fakeMacPing);
  });

  it('reports a reachable host as alive', async () => {
    expect(await pingHost('1.1.1.1', 'ipv4', 'darwin')).toEqual({
      host: '1.1.1.1',
      latencyMs: 15,
      alive: true,
    });
  });

  it('reports IPv6 hosts as alive through ping6', async () => {
    const result = await pingHost('2606:4700:4700::1111', 'ipv6', 'darwin');
    expect(result.alive).toBe(true);
    expect(execFile.mock.calls[0]?.[0]).toBe('/sbin/ping6');
  });

  it('feeds the dashboard and status bar a live connection with default settings', async () => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    try {
      const results = await probeAll({
        pingTargets: ['1.1.1.1'],
        pingMethod: 'icmp',
      });
      expect(results).toEqual([{ host: '1.1.1.1', latencyMs: 15, alive: true }]);
    } finally {
      if (platform) Object.defineProperty(process, 'platform', platform);
    }
  });
});
