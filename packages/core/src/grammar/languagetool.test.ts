import { describe, expect, it } from 'vitest';
import {
  defaultGrammarSettings,
  GRAMMAR_ISSUE_KIND_LABELS,
  GRAMMAR_ISSUE_KINDS,
  GRAMMAR_LANGUAGES,
  GRAMMAR_MOTHER_TONGUES,
  type GrammarIssueKind,
  type GrammarSettings,
  grammarIssueKindFor,
  isGrammarMistake,
  LANGUAGETOOL_DEFAULT_PORT,
  LANGUAGETOOL_LOCAL_MAX_CHARS,
  LANGUAGETOOL_ONLINE_MAX_CHARS,
  normalizeGrammarSettings,
} from './languagetool.js';

/**
 * The kind mapping drives the underline color and which issues "Fix all" is allowed
 * to touch, so a style suggestion being graded as a mistake would let the app rewrite
 * a sentence the user never agreed to change. The settings normalizer guards a
 * hand-edited settings.json, where a bad port surfaces as a check that just fails.
 */

describe('grammarIssueKindFor', () => {
  const cases: [{ issueType?: string | null; categoryId?: string | null }, GrammarIssueKind][] = [
    // A category id wins where both are present, since it is the more specific label.
    [{ categoryId: 'TYPOS' }, 'spelling'],
    [{ issueType: 'misspelling' }, 'spelling'],
    [{ categoryId: 'PUNCTUATION' }, 'punctuation'],
    [{ categoryId: 'TYPOGRAPHY' }, 'typography'],
    [{ issueType: 'typographical' }, 'typography'],
    [{ issueType: 'whitespace' }, 'typography'],
    [{ categoryId: 'STYLE' }, 'style'],
    [{ categoryId: 'REDUNDANCY' }, 'style'],
    [{ categoryId: 'PLAIN_ENGLISH' }, 'style'],
    [{ categoryId: 'CREATIVE_WRITING' }, 'style'],
    [{ issueType: 'style' }, 'style'],
    [{ categoryId: 'GRAMMAR' }, 'grammar'],
    [{ categoryId: 'CASING' }, 'grammar'],
    [{ categoryId: 'CONFUSED_WORDS' }, 'grammar'],
    [{ categoryId: 'COMPOUNDING' }, 'grammar'],
    [{ categoryId: 'SEMANTICS' }, 'grammar'],
    [{ categoryId: 'COLLOCATIONS' }, 'grammar'],
    [{ issueType: 'grammar' }, 'grammar'],
    [{ issueType: 'duplication' }, 'grammar'],
    [{ issueType: 'inconsistency' }, 'grammar'],
  ];

  it.each(cases)('maps %o to %s', (input, expected) => {
    expect(grammarIssueKindFor(input)).toBe(expected);
  });

  it('normalizes case on both labels, which differ per language pack', () => {
    expect(grammarIssueKindFor({ categoryId: 'typos' })).toBe('spelling');
    expect(grammarIssueKindFor({ issueType: 'MISSPELLING' })).toBe('spelling');
    expect(grammarIssueKindFor({ issueType: 'Grammar' })).toBe('grammar');
  });

  it("falls back to 'other' for an unknown, missing or empty label", () => {
    expect(grammarIssueKindFor({})).toBe('other');
    expect(grammarIssueKindFor({ issueType: null, categoryId: null })).toBe('other');
    expect(grammarIssueKindFor({ issueType: '', categoryId: '' })).toBe('other');
    expect(grammarIssueKindFor({ categoryId: 'MISC', issueType: 'uncategorized' })).toBe('other');
  });

  it('lets the category id decide when the two labels disagree', () => {
    expect(grammarIssueKindFor({ categoryId: 'TYPOS', issueType: 'style' })).toBe('spelling');
  });

  it('only ever returns one of the declared kinds', () => {
    const kinds = new Set<string>(GRAMMAR_ISSUE_KINDS);
    for (const [input] of cases) {
      expect(kinds.has(grammarIssueKindFor(input))).toBe(true);
    }
  });
});

describe('isGrammarMistake', () => {
  it('counts spelling, grammar and punctuation as mistakes', () => {
    expect(isGrammarMistake('spelling')).toBe(true);
    expect(isGrammarMistake('grammar')).toBe(true);
    expect(isGrammarMistake('punctuation')).toBe(true);
  });

  it('leaves taste-based kinds out, so "Fix all" never rewrites them', () => {
    expect(isGrammarMistake('style')).toBe(false);
    expect(isGrammarMistake('typography')).toBe(false);
    expect(isGrammarMistake('other')).toBe(false);
  });
});

describe('kind and language tables', () => {
  it('labels every kind', () => {
    for (const kind of GRAMMAR_ISSUE_KINDS) {
      expect(GRAMMAR_ISSUE_KIND_LABELS[kind], kind).toBeTruthy();
    }
    expect(Object.keys(GRAMMAR_ISSUE_KIND_LABELS).sort()).toEqual([...GRAMMAR_ISSUE_KINDS].sort());
  });

  it('offers unique language codes and labels', () => {
    const values = GRAMMAR_LANGUAGES.map((entry) => entry.value);
    const labels = GRAMMAR_LANGUAGES.map((entry) => entry.label);
    expect(new Set(values).size).toBe(values.length);
    expect(new Set(labels).size).toBe(labels.length);
    for (const entry of GRAMMAR_LANGUAGES) {
      expect(entry.value.trim(), entry.label).not.toBe('');
      expect(entry.label.trim(), entry.value).not.toBe('');
    }
  });

  it('drops auto-detect from the mother tongue list, since it has to be a real language', () => {
    expect(GRAMMAR_MOTHER_TONGUES.some((entry) => entry.value === 'auto')).toBe(false);
    expect(GRAMMAR_MOTHER_TONGUES).toHaveLength(GRAMMAR_LANGUAGES.length - 1);
  });

  it('gives the local server a larger budget than the free online tier', () => {
    expect(LANGUAGETOOL_LOCAL_MAX_CHARS).toBeGreaterThan(LANGUAGETOOL_ONLINE_MAX_CHARS);
  });
});

describe('normalizeGrammarSettings', () => {
  it('returns the defaults for a missing or non-object block', () => {
    expect(normalizeGrammarSettings(null)).toEqual(defaultGrammarSettings());
    expect(normalizeGrammarSettings(undefined)).toEqual(defaultGrammarSettings());
  });

  it('treats the two switches as on unless explicitly false', () => {
    expect(normalizeGrammarSettings({}).enabled).toBe(true);
    expect(normalizeGrammarSettings({}).liveCheck).toBe(true);
    expect(normalizeGrammarSettings({ enabled: false }).enabled).toBe(false);
    expect(normalizeGrammarSettings({ liveCheck: false }).liveCheck).toBe(false);
  });

  it("accepts only 'local' as a non-default source", () => {
    expect(normalizeGrammarSettings({ source: 'local' }).source).toBe('local');
    expect(normalizeGrammarSettings({ source: 'online' }).source).toBe('online');
    expect(normalizeGrammarSettings({ source: 'remote' as GrammarSettings['source'] }).source).toBe(
      'online',
    );
  });

  it("falls back to 'auto' for a missing or blank language", () => {
    expect(normalizeGrammarSettings({ language: 'de-DE' }).language).toBe('de-DE');
    expect(normalizeGrammarSettings({ language: '' }).language).toBe('auto');
    expect(normalizeGrammarSettings({ language: 42 as unknown as string }).language).toBe('auto');
  });

  it('leaves the mother tongue null unless a non-empty code is stored', () => {
    expect(normalizeGrammarSettings({}).motherTongue).toBeNull();
    expect(normalizeGrammarSettings({ motherTongue: '' }).motherTongue).toBeNull();
    expect(normalizeGrammarSettings({ motherTongue: 'fa' }).motherTongue).toBe('fa');
  });

  it('treats picky as off unless explicitly true', () => {
    expect(normalizeGrammarSettings({}).picky).toBe(false);
    expect(normalizeGrammarSettings({ picky: true }).picky).toBe(true);
    expect(normalizeGrammarSettings({ picky: 1 as unknown as boolean }).picky).toBe(false);
  });

  it('only accepts an unprivileged port, since the server runs as the user', () => {
    expect(normalizeGrammarSettings({ localPort: 9000 }).localPort).toBe(9000);
    expect(normalizeGrammarSettings({ localPort: 1024 }).localPort).toBe(1024);
    expect(normalizeGrammarSettings({ localPort: 65535 }).localPort).toBe(65535);
    for (const port of [80, 1023, 65536, 8081.5, Number.NaN]) {
      expect(normalizeGrammarSettings({ localPort: port }).localPort, String(port)).toBe(
        LANGUAGETOOL_DEFAULT_PORT,
      );
    }
  });

  it('dedupes ignored rules and drops non-strings', () => {
    expect(
      normalizeGrammarSettings({
        ignoredRules: [
          'OXFORD_SPELLING_Z_NOT_S',
          'OXFORD_SPELLING_Z_NOT_S',
          'EN_QUOTES',
          7 as unknown as string,
        ],
      }).ignoredRules,
    ).toEqual(['OXFORD_SPELLING_Z_NOT_S', 'EN_QUOTES']);
  });

  it('restores an empty rule list when the stored value is not an array', () => {
    expect(
      normalizeGrammarSettings({ ignoredRules: 'EN_QUOTES' as unknown as string[] }).ignoredRules,
    ).toEqual([]);
  });

  it('is idempotent, since the block is normalized on every read', () => {
    const once = normalizeGrammarSettings({
      source: 'local',
      language: 'fa',
      motherTongue: 'fa',
      picky: true,
      localPort: 9000,
      ignoredRules: ['EN_QUOTES'],
    });
    expect(normalizeGrammarSettings(once)).toEqual(once);
  });
});
