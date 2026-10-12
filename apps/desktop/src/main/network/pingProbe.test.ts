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
  pingArgs,
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

describe('pingArgs', () => {
  it('leaves the ping command on its default family for ipv4', () => {
    expect(pingArgs('1.1.1.1', 'ipv4', true)).toEqual(['-n', '1', '-w', '1500', '1.1.1.1']);
    expect(pingArgs('1.1.1.1', 'ipv4', false)).toEqual(['-c', '1', '-W', '2', '1.1.1.1']);
  });

  it('forces IPv6 with -6 on both Windows and POSIX ping', () => {
    const host = '2606:4700:4700::1111';
    expect(pingArgs(host, 'ipv6', true)).toEqual(['-6', '-n', '1', '-w', '1500', host]);
    expect(pingArgs(host, 'ipv6', false)).toEqual(['-6', '-c', '1', '-W', '2', host]);
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
