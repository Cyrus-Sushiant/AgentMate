import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  normalizeHostPort,
  parseAdbConnectResult,
  parseAdbPairResult,
  parseDeviceIpFromIpRoute,
} from './pairing.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf-8');

describe('normalizeHostPort', () => {
  it('accepts what the phone shows on the wireless debugging screen', () => {
    expect(normalizeHostPort('192.168.1.20:37105')).toEqual({
      host: '192.168.1.20',
      port: 37105,
      hostPort: '192.168.1.20:37105',
    });
    expect(normalizeHostPort('  10.0.0.5:5555  ')).toMatchObject({ port: 5555 });
  });

  it('accepts a hostname as well as an address', () => {
    expect(normalizeHostPort('pixel.local:5555')).toMatchObject({ host: 'pixel.local' });
  });

  // This value reaches a command line, so anything that is not a plain host and port is refused
  // rather than escaped.
  it('refuses anything that is not a host and port', () => {
    for (const bad of [
      '',
      '192.168.1.20',
      '192.168.1.20:',
      '192.168.1.20:99999',
      '192.168.1.20:0',
      'evil host:5555',
      '192.168.1.20:5555; rm -rf /',
      '$(whoami):5555',
      '--flag:5555',
    ]) {
      expect(normalizeHostPort(bad), bad).toBeNull();
    }
  });
});

describe('parseAdbPairResult', () => {
  it('reads a successful pairing and its guid', () => {
    const result = parseAdbPairResult(fixture('adb-pair-success.txt'));
    expect(result).toMatchObject({ ok: true, hostPort: '192.168.1.20:37105' });
    expect(result.guid).toContain('adb-39061FDJG0000P');
  });

  it('carries the failure message through so the user can act on it', () => {
    expect(parseAdbPairResult(fixture('adb-pair-failure.txt'))).toEqual({
      ok: false,
      message: 'Wrong password or connection was dropped',
    });
  });
});

describe('parseAdbConnectResult', () => {
  it('treats an existing connection as success', () => {
    expect(parseAdbConnectResult('connected to 192.168.1.20:5555')).toMatchObject({ ok: true });
    expect(parseAdbConnectResult('already connected to 192.168.1.20:5555')).toMatchObject({
      ok: true,
    });
  });

  it('reports a refused connection', () => {
    const result = parseAdbConnectResult(
      "failed to connect to '192.168.1.20:5555': Connection refused",
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Connection refused');
  });
});

describe('parseDeviceIpFromIpRoute', () => {
  it('picks the address the device uses on its wifi interface', () => {
    const out = '192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.20\n';
    expect(parseDeviceIpFromIpRoute(out)).toBe('192.168.1.20');
  });

  it('returns null when there is no wifi route', () => {
    expect(parseDeviceIpFromIpRoute('')).toBeNull();
    expect(parseDeviceIpFromIpRoute('10.0.2.0/24 dev radio0 scope link\n')).toBeNull();
  });
});
