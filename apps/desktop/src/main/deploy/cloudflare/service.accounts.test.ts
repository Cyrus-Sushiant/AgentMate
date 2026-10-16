import { describe, expect, it } from 'vitest';
import { cloudflareErrorCode } from '../../../shared/cloudflareErrors';
import { MIGRATED_ACCOUNT_ID } from './state';
import { ALL_GRANTS } from './testing/fakeCloudflare';
import { makeService, TOKEN } from './testing/harness';
import { OTHER_ZONE_ID, ZONE_ID } from './testing/recorded';

/**
 * Several Cloudflare accounts at once: each has its own sealed token and its own zones, a zone
 * call finds the token of the account that holds the zone, and removing or breaking one account
 * leaves the others alone.
 */

const CLIENT_TOKEN = 'Zt9pR2e6Tq9VxYb1Lk0NsHjW3cZaDf7U8iOoPl5Q';
const CLIENT_TOKEN_ID = 'c'.repeat(32);

/** Two tokens: the first sees example.com, the second only example.org. */
function twoAccounts() {
  return makeService({
    tokens: {
      [TOKEN]: { grants: ALL_GRANTS, zoneIds: [ZONE_ID] },
      [CLIENT_TOKEN]: { grants: ALL_GRANTS, zoneIds: [OTHER_ZONE_ID], id: CLIENT_TOKEN_ID },
    },
    zones: [
      { id: ZONE_ID, name: 'example.com' },
      { id: OTHER_ZONE_ID, name: 'example.org' },
    ],
  });
}

async function connectedPair() {
  const harness = twoAccounts();
  await harness.service.saveToken({ token: TOKEN, label: 'Work' });
  await harness.service.saveToken({ token: CLIENT_TOKEN });
  harness.fake.requests.length = 0;
  return harness;
}

describe('connecting several accounts', () => {
  it('adds each token as its own account and names the ones left unnamed', async () => {
    const { service } = twoAccounts();

    await service.saveToken({ token: TOKEN, label: '  Work  ' });
    const status = await service.saveToken({ token: CLIENT_TOKEN });

    expect(status.configured).toBe(true);
    expect(status.accounts.map((account) => [account.id, account.label])).toEqual([
      ['acct-1', 'Work'],
      ['acct-2', 'Account 2'],
    ]);
    expect(JSON.stringify(status)).not.toContain(CLIENT_TOKEN);
  });

  it('refuses the same token twice, under any name', async () => {
    const { service } = await connectedPair();

    await expect(service.saveToken({ token: TOKEN, label: 'Again' })).rejects.toThrow(
      /already connected as Work/,
    );

    expect((await service.status()).accounts).toHaveLength(2);
  });

  it('replaces the token of one account and keeps its name and place', async () => {
    const { service, fake } = await connectedPair();
    const newer = 'Nn9pR2e6Tq9VxYb1Lk0NsHjW3cZaDf7U8iOoPl5Q';
    fake.tokens[newer] = { grants: ALL_GRANTS, zoneIds: [ZONE_ID], id: 'd'.repeat(32) };

    const status = await service.saveToken({ token: newer, accountId: 'acct-1' });

    expect(status.accounts.map((account) => [account.id, account.label])).toEqual([
      ['acct-1', 'Work'],
      ['acct-2', 'Account 2'],
    ]);
    expect(status.accounts[0]?.report?.tokenId).toBe('d'.repeat(32));
  });

  it('lets an account keep its own token when it is replaced by itself', async () => {
    const { service } = await connectedPair();

    const status = await service.saveToken({ token: TOKEN, accountId: 'acct-1' });

    expect(status.accounts).toHaveLength(2);
  });

  it('refuses to replace an account that is not connected', async () => {
    const { service } = twoAccounts();
    await expect(service.saveToken({ token: TOKEN, accountId: 'nobody' })).rejects.toThrow(
      /not connected any more/,
    );
  });
});

describe('zones across accounts', () => {
  it("lists each account's own zones, tagged with the account", async () => {
    const { service } = await connectedPair();

    const work = await service.listZones('acct-1');
    const client = await service.listZones('acct-2');

    expect(work.map((zone) => [zone.name, zone.accountId])).toEqual([['example.com', 'acct-1']]);
    expect(client.map((zone) => [zone.name, zone.accountId])).toEqual([['example.org', 'acct-2']]);
  });

  it('sends a zone call with the token of the account that holds the zone', async () => {
    const { service, fake } = await connectedPair();
    await service.listZones('acct-1');
    await service.listZones('acct-2');
    fake.requests.length = 0;

    await service.listRecords(ZONE_ID);
    await service.listRecords(OTHER_ZONE_ID);

    const tokens = fake.requests.map((request) => request.headers.get('authorization'));
    expect(tokens).toEqual([`Bearer ${TOKEN}`, `Bearer ${CLIENT_TOKEN}`]);
  });

  it('finds the account of a zone it has not listed yet, such as after a restart', async () => {
    const { service, fake } = await connectedPair();

    await service.listRecords(OTHER_ZONE_ID);

    const records = fake.requests.filter((request) => request.path.endsWith('/dns_records'));
    expect(records.map((request) => request.headers.get('authorization'))).toEqual([
      `Bearer ${CLIENT_TOKEN}`,
    ]);
  });

  it('says so when no account holds the zone', async () => {
    const { service } = await connectedPair();
    await expect(service.listRecords('f'.repeat(32))).rejects.toThrow(
      /not in any of the connected Cloudflare accounts/,
    );
  });

  it('marks a missing permission on the account that was refused, not the others', async () => {
    const { service, fake } = twoAccounts();
    fake.tokens[CLIENT_TOKEN] = {
      grants: { zone: 'read', dns: 'read' },
      zoneIds: [OTHER_ZONE_ID],
      id: CLIENT_TOKEN_ID,
    };
    await service.saveToken({ token: TOKEN });
    await service.saveToken({ token: CLIENT_TOKEN });
    await service.listZones('acct-2');

    await service
      .createRecord(OTHER_ZONE_ID, {
        type: 'TXT',
        name: 'x.example.org',
        content: 'hello',
        ttl: 300,
      })
      .catch(() => undefined);

    const status = await service.status();
    const stateOf = (index: number) =>
      status.accounts[index]?.report?.permissions.find((check) => check.id === 'dns')?.state;
    expect(stateOf(0)).toBe('granted');
    expect(stateOf(1)).not.toBe('granted');
  });

  it('gathers the zones of every account, and skips one that fails', async () => {
    const { service, fake, lock } = await connectedPair();

    expect((await service.allZones()).map((zone) => zone.name).sort()).toEqual([
      'example.com',
      'example.org',
    ]);

    fake.failNext(/^\/zones$/, 401, {
      success: false,
      errors: [{ code: 1000, message: 'Invalid API Token' }],
    });
    expect((await service.allZones()).map((zone) => zone.name)).toEqual(['example.org']);

    lock.value = true;
    expect(cloudflareErrorCode(await service.allZones().catch((error) => error))).toBe('locked');
  });

  it('asks to connect Cloudflare when there are no accounts at all', async () => {
    const { service } = twoAccounts();
    expect(cloudflareErrorCode(await service.allZones().catch((error) => error))).toBe('no-token');
  });
});

describe('removing and checking one account', () => {
  it('forgets one account and leaves the others working', async () => {
    const { service } = await connectedPair();
    await service.listZones('acct-1');

    const status = await service.removeToken('acct-1');

    expect(status.accounts.map((account) => account.id)).toEqual(['acct-2']);
    await expect(service.listRecords(ZONE_ID)).rejects.toThrow(
      /not in any of the connected Cloudflare accounts/,
    );
    expect((await service.listZones('acct-2')).map((zone) => zone.name)).toEqual(['example.org']);
  });

  it('checks only the account asked for', async () => {
    const { service, fake } = await connectedPair();

    await service.checkToken('acct-2');

    expect(new Set(fake.requests.map((request) => request.headers.get('authorization')))).toEqual(
      new Set([`Bearer ${CLIENT_TOKEN}`]),
    );
  });

  it('says whether a token belongs to any connected account', async () => {
    const { service } = await connectedPair();
    expect(await service.isSavedToken(TOKEN)).toBe(true);
    expect(await service.isSavedToken(CLIENT_TOKEN)).toBe(true);
    expect(await service.isSavedToken('Qq9pR2e6Tq9VxYb1Lk0NsHjW3cZaDf7U8iOoPl5Q')).toBe(false);
  });

  it('reports locked as soon as any token is behind the passkey', async () => {
    const { service, lock } = await connectedPair();
    lock.value = true;
    const status = await service.status();
    expect(status.locked).toBe(true);
    expect(status.accounts.every((account) => account.locked)).toBe(true);
  });
});

describe('an account saved by the first version', () => {
  it('keeps working as one account named Cloudflare', async () => {
    const { service, port } = makeService();
    port.value = {
      version: 1,
      token: {
        envelope: {
          mode: 'safeStorage',
          ciphertext: Buffer.from(`sealed:${TOKEN}`).toString('base64'),
        },
        tokenId: 'old',
        savedAt: 1,
      },
      report: null,
    };

    const status = await service.status();
    const zones = await service.listZones(MIGRATED_ACCOUNT_ID);

    expect(status.accounts.map((account) => [account.id, account.label])).toEqual([
      [MIGRATED_ACCOUNT_ID, 'Cloudflare'],
    ]);
    expect(zones.length).toBeGreaterThan(0);
  });
});
