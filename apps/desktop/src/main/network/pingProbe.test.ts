import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PING_TARGETS_IPV6,
  DEFAULT_PING_URL,
  httpProbe,
  isPingIpVersion,
  normalizePingUrlInterval,
  normalizePingUrls,
  parsePingLatency,
  pingCommand,
  pingHost,
  probeAll,
} from './pingProbe';

let server: http.Server | null = null;

async function serve(handler: http.RequestListener): Promise<string> {
  server = http.createServer(handler);
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
}

afterEach(async () => {
  const current = server;
  server = null;
  if (current) await new Promise((resolve) => current.close(resolve));
});

describe('normalizePingUrls', () => {
  it('keeps http(s) urls, drops junk and duplicates', () => {
    expect(
      normalizePingUrls(['https://a.test/x', ' https://a.test/x ', 'ftp://b.test', 'nope', 3]),
    ).toEqual(['https://a.test/x']);
  });

  it('falls back to the default when the value is not a list', () => {
    expect(normalizePingUrls(undefined)).toEqual([DEFAULT_PING_URL]);
  });
});

describe('httpProbe', () => {
  it('counts a 204 as alive with a latency', async () => {
    const url = await serve((_req, res) => {
      res.statusCode = 204;
      res.end();
    });
    const result = await httpProbe(url);
    expect(result.alive).toBe(true);
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('retries with GET when HEAD is refused', async () => {
    const methods: string[] = [];
    const url = await serve((req, res) => {
      methods.push(req.method ?? '');
      res.statusCode = req.method === 'HEAD' ? 405 : 200;
      res.end('ok');
    });
    expect((await httpProbe(url)).alive).toBe(true);
    expect(methods).toEqual(['HEAD', 'GET']);
  });

  it('reports a refused connection as not alive', async () => {
    const url = await serve((_req, res) => res.end());
    await new Promise((resolve) => server?.close(resolve));
    expect((await httpProbe(url)).alive).toBe(false);
  });
});

describe('probeAll', () => {
  it('http mode only touches the urls', async () => {
    const url = await serve((_req, res) => {
      res.statusCode = 204;
      res.end();
    });
    const results = await probeAll({ pingMethod: 'http', pingUrls: [url], pingTargets: ['x'] });
    expect(results.map((r) => r.host)).toEqual([url]);
  });
});

describe('probeAll interval', () => {
  it('reuses url replies until the period has passed', async () => {
    let hits = 0;
    const url = await serve((_req, res) => {
      hits += 1;
      res.statusCode = 204;
      res.end();
    });
    const settings = { pingMethod: 'http' as const, pingUrls: [url], pingUrlIntervalSeconds: 60 };
    await probeAll(settings);
    await probeAll(settings);
    expect(hits).toBe(1);
  });
});

describe('pingCommand', () => {
  it('leaves the ping command on its default family for ipv4', () => {
    expect(pingCommand('1.1.1.1', 'ipv4', 'win32')).toEqual({
      file: 'ping',
      args: ['-n', '1', '-w', '1500', '1.1.1.1'],
    });
    expect(pingCommand('1.1.1.1', 'ipv4', 'linux')).toEqual({
      file: 'ping',
      args: ['-c', '1', '-W', '2', '1.1.1.1'],
    });
  });

  it('forces IPv6 with -6 on Windows and Linux ping', () => {
    const host = '2606:4700:4700::1111';
    expect(pingCommand(host, 'ipv6', 'win32').args).toEqual(['-6', '-n', '1', '-w', '1500', host]);
    expect(pingCommand(host, 'ipv6', 'linux').args).toEqual(['-6', '-c', '1', '-W', '2', host]);
  });

  // macOS -W is milliseconds, not seconds. The Linux flags gave it 2 ms to
  // answer, so the network card and status bar always showed no connection.
  it('gives macOS ping a two second reply wait in milliseconds', () => {
    expect(pingCommand('1.1.1.1', 'ipv4', 'darwin')).toEqual({
      file: '/sbin/ping',
      args: ['-c', '1', '-W', '2000', '1.1.1.1'],
    });
  });

  it('never hands macOS a reply wait under one second', () => {
    const { args } = pingCommand('1.1.1.1', 'ipv4', 'darwin');
    const wait = args.indexOf('-W');
    if (wait >= 0) expect(Number(args[wait + 1])).toBeGreaterThanOrEqual(1000);
  });

  it('pings IPv6 on macOS through ping6, which has no -6 flag', () => {
    const host = '2606:4700:4700::1111';
    expect(pingCommand(host, 'ipv6', 'darwin')).toEqual({
      file: '/sbin/ping6',
      args: ['-c', '1', host],
    });
  });
});

describe('parsePingLatency', () => {
  it('reads a macOS ping reply', () => {
    const stdout = [
      'PING 1.1.1.1 (1.1.1.1): 56 data bytes',
      '64 bytes from 1.1.1.1: icmp_seq=0 ttl=57 time=14.623 ms',
      '',
      '--- 1.1.1.1 ping statistics ---',
      '1 packets transmitted, 1 packets received, 0.0% packet loss',
      'round-trip min/avg/max/stddev = 14.623/14.623/14.623/0.000 ms',
    ].join('\n');
    expect(parsePingLatency(stdout, 'darwin')).toBe(15);
  });

  it('reads a macOS ping6 reply', () => {
    const stdout = [
      'PING6(56=40+8+8 bytes) 2a02:1:2::5 --> 2606:4700:4700::1111',
      '16 bytes from 2606:4700:4700::1111, icmp_seq=0 hlim=58 time=21.402 ms',
    ].join('\n');
    expect(parsePingLatency(stdout, 'darwin')).toBe(21);
  });

  it('reads Linux and Windows replies', () => {
    expect(parsePingLatency('64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=9.87 ms', 'linux')).toBe(
      10,
    );
    expect(parsePingLatency('Reply from 1.1.1.1: bytes=32 time=12ms TTL=57', 'win32')).toBe(12);
    expect(parsePingLatency('Reply from 127.0.0.1: bytes=32 time<1ms TTL=128', 'win32')).toBe(1);
  });

  it('treats a macOS timeout as no reply', () => {
    const stdout = [
      'PING 1.1.1.1 (1.1.1.1): 56 data bytes',
      '',
      '--- 1.1.1.1 ping statistics ---',
      '1 packets transmitted, 0 packets received, 100.0% packet loss',
    ].join('\n');
    expect(parsePingLatency(stdout, 'darwin')).toBeNull();
  });
});

describe('pingHost on this machine', () => {
  it('gets a reply from loopback', async () => {
    const result = await pingHost('127.0.0.1');
    expect(result).toMatchObject({ host: '127.0.0.1', alive: true });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe('IPv6 ping defaults', () => {
  it('uses Cloudflare and Google public DNS', () => {
    expect(DEFAULT_PING_TARGETS_IPV6).toEqual(['2606:4700:4700::1111', '2001:4860:4860::8888']);
  });

  it('accepts only the two known IP versions', () => {
    expect(isPingIpVersion('ipv4')).toBe(true);
    expect(isPingIpVersion('ipv6')).toBe(true);
    expect(isPingIpVersion('ipv5')).toBe(false);
    expect(isPingIpVersion(undefined)).toBe(false);
  });
});

describe('normalizePingUrlInterval', () => {
  it('clamps and defaults', () => {
    expect(normalizePingUrlInterval(0)).toBe(1);
    expect(normalizePingUrlInterval(9999)).toBe(300);
    expect(normalizePingUrlInterval('x')).toBe(5);
  });
});
