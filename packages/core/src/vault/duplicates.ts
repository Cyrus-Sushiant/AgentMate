import {
  applySaveInput,
  type EntryClock,
  type SaveVaultEntryInput,
  type VaultEntry,
} from './entries.js';
import { hostOf } from './url.js';

export type DuplicateKind = 'identical' | 'conflict';
export type DuplicatePolicy = 'skip' | 'replace' | 'keepBoth';

export interface DuplicateMatch {
  /** Index into the incoming list. */
  index: number;
  existingId: string;
  kind: DuplicateKind;
}

type Comparable = VaultEntry | SaveVaultEntryInput;

/** What makes two items "the same account", or null when there is nothing to match on. */
function identityKey(item: Comparable): string | null {
  switch (item.type) {
    case 'login': {
      const host = hostOf(item.urls?.[0] ?? '');
      const username = (item.username ?? '').trim().toLowerCase();
      return host || username ? `login|${host}|${username}` : null;
    }
    case 'apiKey': {
      const service = (item.service ?? '').trim().toLowerCase();
      const keyId = (item.keyId ?? '').trim().toLowerCase();
      return service || keyId ? `apiKey|${service}|${keyId}` : null;
    }
    case 'note':
    case 'custom':
      return `${item.type}|${item.title.trim().toLowerCase()}`;
  }
}

/** The part that decides whether a match is an exact copy or a conflicting version. */
function secretFingerprint(item: Comparable): string {
  switch (item.type) {
    case 'login':
      return JSON.stringify([item.password ?? '', item.totpSecret ?? '']);
    case 'apiKey':
      return JSON.stringify([item.secret ?? '']);
    case 'note':
      return JSON.stringify([item.notes ?? '']);
    case 'custom':
      return JSON.stringify(item.fields.map((f) => [f.label.trim(), f.value ?? '']));
  }
}

function matchAgainst(existing: VaultEntry[], item: SaveVaultEntryInput) {
  const key = identityKey(item);
  if (key === null) return null;
  const found = existing.find((entry) => identityKey(entry) === key);
  if (!found) return null;
  const kind: DuplicateKind =
    secretFingerprint(found) === secretFingerprint(item) ? 'identical' : 'conflict';
  return { existingId: found.id, kind };
}

export function findDuplicates(
  existing: VaultEntry[],
  incoming: SaveVaultEntryInput[],
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  incoming.forEach((item, index) => {
    const match = matchAgainst(existing, item);
    if (match) matches.push({ index, ...match });
  });
  return matches;
}

export interface ImportPlan {
  entries: VaultEntry[];
  added: number;
  replaced: number;
  skipped: number;
}

/**
 * The vault after an import. Exact copies are always skipped. A conflicting version is skipped,
 * written over the stored entry, or added next to it, depending on the policy. Items repeated
 * inside the file are checked against the ones added before them.
 */
export function planImport(
  existing: VaultEntry[],
  incoming: SaveVaultEntryInput[],
  policy: DuplicatePolicy,
  clock: EntryClock,
): ImportPlan {
  const entries = existing.map((entry) => structuredClone(entry));
  const plan: ImportPlan = { entries, added: 0, replaced: 0, skipped: 0 };

  for (const item of incoming) {
    const match = matchAgainst(entries, item);
    if (match && (match.kind === 'identical' || policy === 'skip')) {
      plan.skipped++;
      continue;
    }
    if (match && policy === 'replace') {
      const at = entries.findIndex((entry) => entry.id === match.existingId);
      const { id: _ignored, ...rest } = item;
      entries[at] = applySaveInput(entries[at], { ...rest, id: match.existingId }, clock);
      plan.replaced++;
      continue;
    }
    const { id: _ignored, ...rest } = item;
    entries.push(applySaveInput(undefined, rest, clock));
    plan.added++;
  }
  return plan;
}
