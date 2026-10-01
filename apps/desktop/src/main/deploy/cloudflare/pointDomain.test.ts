import { describe, expect, it, vi } from 'vitest';
import type { CloudflareDnsRecord } from '../../../shared/cloudflareTypes';
import { addressesOfHost, planChanges, pointedNames } from './pointDomain';

/**
 * T5 and AC2: "point domain to this server" works out which address records to create, change
 * or remove so that a name (and optionally www) reaches the server and nothing else, and a second
 * run finds nothing to do.
 */

function record(overrides: Partial<CloudflareDnsRecord>): CloudflareDnsRecord {
  return {
    id: 'a'.repeat(32),
    type: 'A',
    name: 'example.com',
    content: '198.51.100.4',
    ttl: 1,
    proxied: true,
    proxiable: true,
    editable: true,
    ...overrides,
  };
}

const ADDRESSES = { ipv4: ['203.0.113.10'], ipv6: ['2001:db8::10'] };

describe('pointedNames', () => {
  it('covers the name and, when asked, its www', () => {
    expect(pointedNames('@', 'example.com', true)).toEqual(['example.com', 'www.example.com']);
    expect(pointedNames('app', 'example.com', false)).toEqual(['app.example.com']);
    expect(pointedNames('www', 'example.com', true)).toEqual(['www.example.com']);
    expect(pointedNames('bad name', 'example.com', true)).toBeNull();
  });
});

describe('planChanges', () => {
  it('creates the address records a fresh name needs', () => {
    const changes = planChanges({
      names: ['example.com', 'www.example.com'],
      addresses: ADDRESSES,
      proxied: true,
      existing: [],
    });
    expect(changes).toEqual([
      { action: 'create', type: 'A', name: 'example.com', content: '203.0.113.10', proxied: true },
      {
        action: 'create',
        type: 'AAAA',
        name: 'example.com',
        content: '2001:db8::10',
        proxied: true,
      },
      {
        action: 'create',
        type: 'A',
        name: 'www.example.com',
        content: '203.0.113.10',
        proxied: true,
      },
      {
        action: 'create',
        type: 'AAAA',
        name: 'www.example.com',
        content: '2001:db8::10',
        proxied: true,
      },
    ]);
  });

  it('reuses a record that points elsewhere, keeps a right one, and removes the extra', () => {
    const changes = planChanges({
      names: ['example.com'],
      addresses: { ipv4: ['203.0.113.10', '203.0.113.11'], ipv6: [] },
      proxied: false,
      existing: [
        record({ id: '1'.repeat(32), content: '203.0.113.10', proxied: false, ttl: 300 }),
        record({ id: '2'.repeat(32), content: '198.51.100.4' }),
        record({ id: '3'.repeat(32), type: 'AAAA', content: '2001:db8::99' }),
        record({ id: '4'.repeat(32), type: 'TXT', content: 'v=spf1 -all', proxiable: false }),
      ],
    });
    expect(changes).toEqual([
      {
        action: 'keep',
        type: 'A',
        name: 'example.com',
        content: '203.0.113.10',
        proxied: false,
        recordId: '1'.repeat(32),
      },
      {
        action: 'update',
        type: 'A',
        name: 'example.com',
        content: '203.0.113.11',
        previous: '198.51.100.4',
        proxied: false,
        recordId: '2'.repeat(32),
      },
      {
        action: 'delete',
        type: 'AAAA',
        name: 'example.com',
        content: '2001:db8::99',
        proxied: true,
        recordId: '3'.repeat(32),
        reason: 'other-address',
      },
    ]);
  });

  it('turns the proxy on or off on a record that already has the right address', () => {
    const [change] = planChanges({
      names: ['example.com'],
      addresses: { ipv4: ['203.0.113.10'], ipv6: [] },
      proxied: true,
      existing: [record({ content: '203.0.113.10', proxied: false })],
    });
    expect(change).toMatchObject({ action: 'update', previous: '203.0.113.10', proxied: true });
  });

  it('removes a CNAME first, since it cannot share a name with address records', () => {
    const changes = planChanges({
      names: ['www.example.com'],
      addresses: { ipv4: ['203.0.113.10'], ipv6: [] },
      proxied: true,
      existing: [record({ type: 'CNAME', name: 'www.example.com', content: 'example.com' })],
    });
    expect(changes).toEqual([
      {
        action: 'delete',
        type: 'CNAME',
        name: 'www.example.com',
        content: 'example.com',
        proxied: true,
        recordId: 'a'.repeat(32),
        reason: 'cname-conflict',
      },
      {
        action: 'create',
        type: 'A',
        name: 'www.example.com',
        content: '203.0.113.10',
        proxied: true,
      },
    ]);
  });

  it('matches IPv6 however it is written', () => {
    const changes = planChanges({
      names: ['example.com'],
      addresses: { ipv4: [], ipv6: ['2001:0db8:0000:0000:0000:0000:0000:0010'] },
      proxied: true,
      existing: [record({ type: 'AAAA', content: '2001:db8::10' })],
    });
    expect(changes.map((change) => change.action)).toEqual(['keep']);
  });
});

describe('addressesOfHost', () => {
  it('takes an address as it is, brackets and all', async () => {
    const lookup = vi.fn();
    expect(await addressesOfHost('203.0.113.10', lookup)).toEqual({
      ipv4: ['203.0.113.10'],
      ipv6: [],
    });
    expect(await addressesOfHost('[2001:db8::10]', lookup)).toEqual({
      ipv4: [],
      ipv6: ['2001:db8::10'],
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('resolves a name and keeps the addresses the internet can reach', async () => {
    const lookup = vi.fn(async () => [
      { address: '203.0.113.10', family: 4 },
      { address: '10.0.0.5', family: 4 },
      { address: '2001:db8::10', family: 6 },
      { address: '203.0.113.10', family: 4 },
    ]);
    expect(await addressesOfHost('prod.example.net', lookup)).toEqual({
      ipv4: ['203.0.113.10'],
      ipv6: ['2001:db8::10'],
    });
    expect(lookup).toHaveBeenCalledWith('prod.example.net');
  });

  it('refuses a server only a local network can reach, saying why', async () => {
    await expect(addressesOfHost('192.168.1.20', vi.fn())).rejects.toThrow(
      '192.168.1.20 is a private or local address',
    );
    await expect(
      addressesOfHost('nas.local', async () => [{ address: '192.168.1.20', family: 4 }]),
    ).rejects.toThrow('nas.local only resolves to private or local addresses (192.168.1.20)');
    await expect(
      addressesOfHost('gone.example.net', async () => {
        throw new Error('ENOTFOUND');
      }),
    ).rejects.toThrow('Could not look up gone.example.net');
  });
});
