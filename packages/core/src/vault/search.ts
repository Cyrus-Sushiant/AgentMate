import type { VaultEntryType } from './entries.js';
import type { VaultEntrySummary } from './summary.js';

export type VaultSort = 'title' | 'recent' | 'updated' | 'created';

export interface ParsedVaultQuery {
  terms: string[];
  tags: string[];
  types: VaultEntryType[];
  favoritesOnly: boolean;
}

export interface VaultSearchOptions {
  types?: VaultEntryType[];
  tags?: string[];
  favoritesOnly?: boolean;
  /** Order used when the query has no plain terms to rank by. */
  sort?: VaultSort;
}

export interface VaultSearchHit {
  summary: VaultEntrySummary;
  score: number;
  /** [start, end) ranges in the original title to highlight. */
  titleRanges: [number, number][];
}

const TYPE_ALIASES: Record<string, VaultEntryType> = {
  login: 'login',
  logins: 'login',
  password: 'login',
  passwords: 'login',
  api: 'apiKey',
  apikey: 'apiKey',
  apikeys: 'apiKey',
  key: 'apiKey',
  keys: 'apiKey',
  token: 'apiKey',
  tokens: 'apiKey',
  note: 'note',
  notes: 'note',
  custom: 'custom',
};

/** Lowercase, accents stripped, compatibility forms folded (so "Café" and "cafe" are equal). */
export function foldText(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

export function parseVaultQuery(query: string): ParsedVaultQuery {
  const parsed: ParsedVaultQuery = { terms: [], tags: [], types: [], favoritesOnly: false };
  for (const raw of query.split(/\s+/)) {
    const token = foldText(raw);
    if (!token) continue;
    const [, operator, value] = token.match(/^(tag|type|is):(.+)$/) ?? [];
    if (operator === 'tag') {
      parsed.tags.push(value);
    } else if (operator === 'type' && TYPE_ALIASES[value]) {
      parsed.types.push(TYPE_ALIASES[value]);
    } else if (
      operator === 'is' &&
      (value === 'fav' || value === 'favorite' || value === 'starred')
    ) {
      parsed.favoritesOnly = true;
    } else {
      parsed.terms.push(token);
    }
  }
  return parsed;
}

interface Folded {
  text: string;
  /** For each UTF-16 unit of `text`, where its source character starts and ends in the original. */
  start: number[];
  end: number[];
}

function foldWithMap(original: string): Folded {
  const folded: Folded = { text: '', start: [], end: [] };
  for (let i = 0; i < original.length; ) {
    const char = String.fromCodePoint(original.codePointAt(i) ?? 0);
    const piece = foldText(char);
    for (let unit = 0; unit < piece.length; unit++) {
      folded.start.push(i);
      folded.end.push(i + char.length);
    }
    folded.text += piece;
    i += char.length;
  }
  return folded;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

interface FieldMatch {
  quality: number;
  index: number;
}

/** 1 = whole word(s), 0.8 = start of a word, 0.5 = anywhere, else no match. */
function matchField(text: string, token: string): FieldMatch | null {
  let best: FieldMatch | null = null;
  for (let at = text.indexOf(token); at !== -1; at = text.indexOf(token, at + 1)) {
    const atWordStart = at === 0 || !WORD_CHAR.test(text[at - 1]) || !WORD_CHAR.test(token[0]);
    const after = text[at + token.length];
    const atWordEnd = after === undefined || !WORD_CHAR.test(after);
    const quality = atWordStart ? (atWordEnd ? 1 : 0.8) : 0.5;
    if (!best || quality > best.quality) best = { quality, index: at };
    if (quality === 1) break;
  }
  return best;
}

/** Indexes of the token's letters found in order, or null. */
function subsequence(text: string, token: string): number[] | null {
  const positions: number[] = [];
  let from = 0;
  for (const char of token) {
    const at = text.indexOf(char, from);
    if (at === -1) return null;
    positions.push(at);
    from = at + char.length;
  }
  return positions;
}

const WEIGHTS = {
  title: 10,
  host: 6,
  username: 5,
  service: 5,
  tag: 4,
  keyId: 3,
  url: 2,
  field: 1,
} as const;

function secondaryFields(summary: VaultEntrySummary): [string, number][] {
  const fields: [string, number][] = [
    [summary.host, WEIGHTS.host],
    [summary.username, WEIGHTS.username],
    [summary.service, WEIGHTS.service],
    [summary.keyId, WEIGHTS.keyId],
  ];
  for (const tag of summary.tags) fields.push([tag, WEIGHTS.tag]);
  for (const url of summary.urls) fields.push([url, WEIGHTS.url]);
  for (const field of summary.fields) {
    fields.push([field.label, WEIGHTS.field]);
    if (field.value) fields.push([field.value, WEIGHTS.field]);
  }
  return fields.filter(([text]) => text !== '').map(([text, weight]) => [foldText(text), weight]);
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range[0] < last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}

const compareTitle = (a: VaultEntrySummary, b: VaultEntrySummary) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });

const newestFirst = (a: number | null, b: number | null) => (b ?? -1) - (a ?? -1);

export function sortEntries(summaries: VaultEntrySummary[], sort: VaultSort): VaultEntrySummary[] {
  const copy = [...summaries];
  switch (sort) {
    case 'title':
      return copy.sort(compareTitle);
    case 'updated':
      return copy.sort((a, b) => b.updatedAt - a.updatedAt || compareTitle(a, b));
    case 'created':
      return copy.sort((a, b) => b.createdAt - a.createdAt || compareTitle(a, b));
    case 'recent':
      return copy.sort(
        (a, b) =>
          newestFirst(a.lastUsedAt, b.lastUsedAt) ||
          b.updatedAt - a.updatedAt ||
          compareTitle(a, b),
      );
  }
}

function passesFilters(
  summary: VaultEntrySummary,
  parsed: ParsedVaultQuery,
  options: VaultSearchOptions,
): boolean {
  if ((parsed.favoritesOnly || options.favoritesOnly) && !summary.favorite) return false;
  for (const types of [parsed.types, options.types ?? []]) {
    if (types.length > 0 && !types.includes(summary.type)) return false;
  }
  const tags = [...parsed.tags, ...(options.tags ?? []).map(foldText)];
  if (tags.length > 0) {
    const own = new Set(summary.tags.map(foldText));
    if (!tags.every((tag) => own.has(tag))) return false;
  }
  return true;
}

/**
 * Every plain term has to match somewhere. Each term scores its best field (title counts most,
 * then host, username and so on) by how cleanly it matches, and favorites get a small boost.
 */
export function searchEntries(
  summaries: VaultEntrySummary[],
  query: string,
  options: VaultSearchOptions = {},
): VaultSearchHit[] {
  const parsed = parseVaultQuery(query);
  const candidates = summaries.filter((s) => passesFilters(s, parsed, options));

  if (parsed.terms.length === 0) {
    return sortEntries(candidates, options.sort ?? 'title').map((summary) => ({
      summary,
      score: 0,
      titleRanges: [],
    }));
  }

  const hits: VaultSearchHit[] = [];
  for (const summary of candidates) {
    const title = foldWithMap(summary.title);
    const others = secondaryFields(summary);
    const ranges: [number, number][] = [];
    let total = 0;
    let matchedAll = true;

    for (const term of parsed.terms) {
      let best = 0;
      let bestRanges: [number, number][] = [];
      const titleMatch = matchField(title.text, term);
      if (titleMatch) {
        best = titleMatch.quality * WEIGHTS.title;
        const last = titleMatch.index + term.length - 1;
        bestRanges = [[title.start[titleMatch.index], title.end[last]]];
      }
      for (const [text, weight] of others) {
        const match = matchField(text, term);
        if (match && match.quality * weight > best) {
          best = match.quality * weight;
          bestRanges = [];
        }
      }
      if (best === 0 && term.length >= 2) {
        const positions = subsequence(title.text, term);
        if (positions) {
          best = 0.2 * WEIGHTS.title;
          bestRanges = positions.map((p) => [title.start[p], title.end[p]]);
        }
      }
      if (best === 0) {
        matchedAll = false;
        break;
      }
      total += best;
      ranges.push(...bestRanges);
    }

    if (matchedAll) {
      hits.push({
        summary,
        score: summary.favorite ? total * 1.1 : total,
        titleRanges: mergeRanges(ranges),
      });
    }
  }

  return hits.sort(
    (a, b) =>
      b.score - a.score ||
      newestFirst(a.summary.lastUsedAt, b.summary.lastUsedAt) ||
      compareTitle(a.summary, b.summary),
  );
}
