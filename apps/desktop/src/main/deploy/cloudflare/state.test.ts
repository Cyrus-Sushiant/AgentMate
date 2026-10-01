import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { SecretEnvelope } from '../../../shared/apiTypes';
import type { CloudflareTokenReport } from '../../../shared/cloudflareTypes';
import { CloudflareState, type CloudflareStatePort, cloudflareFilePort } from './state';

/**
 * Where the Cloudflare token lives at rest: sealed, in cloudflare.json beside the other stores,
 * with the last permission check next to it. Nothing unreadable is trusted.
 */

const SEALED: SecretEnvelope = { mode: 'safeStorage', ciphertext: 'c2VhbGVk' };
const REPORT: CloudflareTokenReport = {
  tokenId: 'ed17574386854bf78a67040be0a770b0',
  status: 'active',
  expiresOn: null,
  source: 'probes',
  permissions: [
    { id: 'zone', state: 'granted' },
    { id: 'dns', state: 'granted' },
  ],
  zoneCount: 2,
  checkedAt: 1,
};

function memoryPort(initial: unknown = null): CloudflareStatePort & { value: unknown } {
  const port = {
    value: initial,
    read: async () => port.value,
    write: async (value: unknown) => {
      port.value = JSON.parse(JSON.stringify(value));
    },
  };
  return port;
}

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe('CloudflareState', () => {
  it('keeps the sealed token and its report, and forgets both together', async () => {
    const state = new CloudflareState(memoryPort());
    expect(await state.token()).toBeNull();

    await state.save({ envelope: SEALED, tokenId: REPORT.tokenId, savedAt: 5 }, REPORT);
    expect(await state.token()).toEqual({ envelope: SEALED, tokenId: REPORT.tokenId, savedAt: 5 });
    expect(await state.report()).toEqual(REPORT);

    await state.clear();
    expect(await state.token()).toBeNull();
    expect(await state.report()).toBeNull();
  });

  it('marks a permission missing after Cloudflare refused a change for want of it', async () => {
    const state = new CloudflareState(memoryPort());
    await state.save({ envelope: SEALED, tokenId: REPORT.tokenId, savedAt: 5 }, REPORT);

    await state.markMissing('dns');
    await state.markMissing('waf');

    expect((await state.report())?.permissions).toEqual([
      { id: 'zone', state: 'granted' },
      { id: 'dns', state: 'missing' },
    ]);
    await state.setReport({ ...REPORT, zoneCount: 3 });
    expect((await state.report())?.zoneCount).toBe(3);
  });

  it('does nothing to a report when there is none', async () => {
    const state = new CloudflareState(memoryPort());
    await state.markMissing('dns');
    expect(await state.report()).toBeNull();
  });

  it('drops what it cannot read rather than trusting it', async () => {
    for (const junk of [
      null,
      'nope',
      { version: 2, token: { envelope: SEALED, tokenId: 'x', savedAt: 1 } },
      {
        version: 1,
        token: { envelope: { mode: 'other', ciphertext: 'x' }, tokenId: 'x', savedAt: 1 },
      },
      { version: 1, token: { envelope: SEALED, tokenId: 7, savedAt: 1 } },
      {
        version: 1,
        token: { envelope: { mode: 'passphrase', ciphertext: 'x' }, tokenId: 'x', savedAt: 1 },
      },
      { version: 1, report: { tokenId: 'x', permissions: 'all' } },
    ]) {
      const state = new CloudflareState(memoryPort(junk));
      expect(await state.token(), JSON.stringify(junk)).toBeNull();
      expect(await state.report(), JSON.stringify(junk)).toBeNull();
    }
    const passphrase: SecretEnvelope = {
      mode: 'passphrase',
      ciphertext: 'x',
      iv: 'i',
      authTag: 't',
    };
    const kept = new CloudflareState(
      memoryPort({
        version: 1,
        token: { envelope: passphrase, tokenId: 'x', savedAt: 1 },
        report: null,
      }),
    );
    expect((await kept.token())?.envelope).toEqual(passphrase);
  });

  it('moves the sealed token to a new passkey only when told to commit', async () => {
    const port = memoryPort();
    const state = new CloudflareState(port);
    await state.save({ envelope: SEALED, tokenId: REPORT.tokenId, savedAt: 5 }, REPORT);
    const moved: SecretEnvelope = {
      mode: 'passphrase',
      ciphertext: 'bmV3',
      iv: 'aXY=',
      authTag: 'dA==',
    };

    const commit = await state.sealedKeys.prepare(async () => moved);
    expect((await state.token())?.envelope).toEqual(SEALED);
    await commit();
    expect((await state.token())?.envelope).toEqual(moved);

    const empty = new CloudflareState(memoryPort());
    await (await empty.sealedKeys.prepare(async () => moved))();
    expect(await empty.token()).toBeNull();
  });
});

describe('cloudflareFilePort', () => {
  it('writes a file only the user can read, and reads it back', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'agentmate-cloudflare-'));
    folders.push(folder);
    const path = join(folder, 'data', 'cloudflare.json');
    const port = cloudflareFilePort(path);

    expect(await port.read()).toBeNull();
    await port.write({ version: 1, token: null, report: REPORT });
    expect(await port.read()).toEqual({ version: 1, token: null, report: REPORT });
    expect(JSON.parse(readFileSync(path, 'utf-8')).report.tokenId).toBe(REPORT.tokenId);
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600);

    writeFileSync(path, '{ not json');
    expect(await port.read()).toBeNull();
  });

  it('passes on errors other than a missing file', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'agentmate-cloudflare-'));
    folders.push(folder);
    await expect(cloudflareFilePort(folder).read()).rejects.toThrow();
  });
});
