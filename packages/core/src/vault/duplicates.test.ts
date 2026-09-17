import { describe, expect, it } from 'vitest';
import { findDuplicates, planImport } from './duplicates.js';
import { applySaveInput, type SaveVaultEntryInput, type VaultEntry } from './entries.js';

const NOW = 1_700_000_000_000;
const LATER = NOW + 1000;

const loginInput = (overrides: Partial<Extract<SaveVaultEntryInput, { type: 'login' }>> = {}) =>
  ({
    type: 'login',
    title: 'GitHub',
    tags: [],
    favorite: false,
    notes: '',
    username: 'octocat',
    password: 'same-pass',
    urls: ['https://github.com/login'],
    totpSecret: '',
    ...overrides,
  }) satisfies SaveVaultEntryInput;

function existing(): VaultEntry[] {
  let n = 0;
  const clock = { now: NOW, newId: () => `old${++n}` };
  return [
    applySaveInput(undefined, loginInput(), clock),
    applySaveInput(
      undefined,
      {
        type: 'apiKey',
        title: 'Stripe',
        tags: [],
        favorite: false,
        notes: '',
        service: 'Stripe',
        keyId: 'pk_1',
        secret: 'sk_1',
        urls: [],
        expiresAt: null,
      },
      clock,
    ),
    applySaveInput(
      undefined,
      { type: 'note', title: 'Wi-Fi', tags: [], favorite: false, notes: 'guest' },
      clock,
    ),
  ];
}

describe('findDuplicates', () => {
  it('matches logins by host and username, ignoring www, path and case', () => {
    const matches = findDuplicates(existing(), [
      loginInput({ urls: ['https://WWW.github.com/other'], username: 'OctoCat', title: 'Renamed' }),
      loginInput({ password: 'different' }),
      loginInput({ username: 'someone-else' }),
    ]);
    expect(matches).toEqual([
      { index: 0, existingId: 'old1', kind: 'identical' },
      { index: 1, existingId: 'old1', kind: 'conflict' },
    ]);
  });

  it('matches api keys by service and key id, notes and custom entries by title', () => {
    const matches = findDuplicates(existing(), [
      {
        type: 'apiKey',
        title: 'x',
        tags: [],
        favorite: false,
        service: 'stripe',
        keyId: 'pk_1',
        secret: 'sk_other',
      },
      { type: 'note', title: 'wi-fi', tags: [], favorite: false, notes: 'guest' },
      { type: 'note', title: 'Other', tags: [], favorite: false, notes: 'guest' },
    ]);
    expect(matches).toEqual([
      { index: 0, existingId: 'old2', kind: 'conflict' },
      { index: 1, existingId: 'old3', kind: 'identical' },
    ]);
  });

  it('treats a login with no url and no username as unique', () => {
    expect(
      findDuplicates(existing(), [loginInput({ urls: [], username: '', title: 'GitHub' })]),
    ).toEqual([]);
  });
});

describe('planImport', () => {
  let n = 0;
  const clock = { now: LATER, newId: () => `new${++n}` };
  const incoming: SaveVaultEntryInput[] = [
    loginInput(),
    loginInput({ password: 'changed-pass' }),
    loginInput({ title: 'Brand new', urls: ['https://new.example'], username: 'me' }),
  ];

  it('always skips identical copies and skips conflicts with the skip policy', () => {
    const plan = planImport(existing(), incoming, 'skip', clock);
    expect(plan).toMatchObject({ added: 1, replaced: 0, skipped: 2 });
    expect(plan.entries).toHaveLength(4);
    expect(plan.entries.at(-1)?.title).toBe('Brand new');
  });

  it('overwrites the stored entry in place with the replace policy, keeping its id and createdAt', () => {
    const plan = planImport(existing(), incoming, 'replace', clock);
    expect(plan).toMatchObject({ added: 1, replaced: 1, skipped: 1 });
    const replaced = plan.entries.find((e) => e.id === 'old1');
    expect(replaced).toMatchObject({ password: 'changed-pass', createdAt: NOW, updatedAt: LATER });
    expect(plan.entries).toHaveLength(4);
  });

  it('adds conflicts as new entries with the keepBoth policy', () => {
    const plan = planImport(existing(), incoming, 'keepBoth', clock);
    expect(plan).toMatchObject({ added: 2, replaced: 0, skipped: 1 });
    expect(plan.entries).toHaveLength(5);
  });

  it('collapses duplicates inside the file itself', () => {
    const plan = planImport([], [loginInput(), loginInput()], 'keepBoth', clock);
    expect(plan).toMatchObject({ added: 1, skipped: 1 });
  });

  it('does not mutate the list it was given', () => {
    const list = existing();
    const before = structuredClone(list);
    planImport(list, incoming, 'replace', clock);
    expect(list).toEqual(before);
  });
});

describe('duplicates: less common paths', () => {
  const clock = { now: NOW, newId: () => 'x1' };

  it('never matches an API key with neither service nor key id', () => {
    const keyless: SaveVaultEntryInput = { type: 'apiKey', title: 'k', tags: [], favorite: false };
    expect(findDuplicates([applySaveInput(undefined, keyless, clock)], [keyless])).toEqual([]);
  });

  it('compares custom entries by their field values', () => {
    const custom = (value: string): SaveVaultEntryInput => ({
      type: 'custom',
      title: 'Router',
      tags: [],
      favorite: false,
      fields: [{ label: 'PIN', value, concealed: true }],
    });
    const saved = [applySaveInput(undefined, custom('1234'), clock)];
    expect(findDuplicates(saved, [custom('1234'), custom('9999')])).toEqual([
      { index: 0, existingId: 'x1', kind: 'identical' },
      { index: 1, existingId: 'x1', kind: 'conflict' },
    ]);
  });

  it('treats missing secrets in an incoming item as empty', () => {
    const saved = [
      applySaveInput(
        undefined,
        { type: 'login', title: 'L', tags: [], favorite: false, username: 'u', urls: ['a.com'] },
        clock,
      ),
    ];
    expect(
      findDuplicates(saved, [
        { type: 'login', title: 'L', tags: [], favorite: false, username: 'u', urls: ['a.com'] },
      ]),
    ).toEqual([{ index: 0, existingId: 'x1', kind: 'identical' }]);
  });
});
