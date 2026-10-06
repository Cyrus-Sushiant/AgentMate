import { describe, expect, it } from 'vitest';
import { parseArticle } from './parse';
import { createHelpSearch, highlightRanges, makeSnippet, searchTerms, tokenize } from './search';

const vault = parseArticle(
  'vault',
  `---
title: Vault
category: Connect
order: 40
summary: Keep secrets encrypted.
keywords: secrets, passwords
---
The Vault keeps API keys and passwords encrypted on this computer.

## Unlock the vault

Type your master password and press Enter.

## Share a secret with a terminal

Pick a secret and choose a terminal to send it to.
`,
);

const workspace = parseArticle(
  'workspace',
  `---
title: Workspace
category: Workspace
order: 10
summary: Run agents side by side.
keywords: terminal, panes
---
The Workspace runs terminals and agents in panes.

## Split a pane

Drag a tab to the edge to split the pane. Terminals keep running.
`,
);

const search = createHelpSearch([vault, workspace]);

describe('tokenize', () => {
  it('lowercases and splits on anything that is not a letter or digit', () => {
    expect(tokenize('Split a Pane, then Ctrl+K!')).toEqual([
      'split',
      'a',
      'pane',
      'then',
      'ctrl',
      'k',
    ]);
  });

  it('keeps non-latin words whole', () => {
    expect(tokenize('راهنما برنامه')).toEqual(['راهنما', 'برنامه']);
  });
});

describe('searchTerms', () => {
  it('drops filler words and repeats', () => {
    expect(searchTerms('How do I split the pane, the PANE?')).toEqual(['split', 'pane']);
  });

  it('keeps filler words when nothing else is left', () => {
    expect(searchTerms('how to')).toEqual(['how', 'to']);
  });
});

describe('createHelpSearch', () => {
  it('returns nothing for an empty query', () => {
    expect(search('   ')).toEqual([]);
  });

  it('ranks a title match above a body mention', () => {
    const hits = search('vault');
    expect(hits[0]).toMatchObject({ slug: 'vault' });
  });

  it('points at the section that matched best', () => {
    const [hit] = search('master password');
    expect(hit).toMatchObject({
      slug: 'vault',
      sectionId: 'unlock-the-vault',
      heading: 'Unlock the vault',
    });
    expect(hit?.snippet).toContain('master password');
  });

  it('matches word prefixes as you type', () => {
    expect(search('termin')[0]).toMatchObject({ slug: 'workspace' });
  });

  it('finds an article by its keywords', () => {
    expect(search('secrets')[0]).toMatchObject({ slug: 'vault' });
  });

  it('gives one hit per article', () => {
    const slugs = search('terminal').map((h) => h.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain('vault');
    expect(slugs).toContain('workspace');
  });

  it('ignores filler words when real words are present', () => {
    expect(search('how do I split a pane')[0]).toMatchObject({
      slug: 'workspace',
      sectionId: 'split-a-pane',
    });
  });

  it('falls back to partial matches when no section has every word', () => {
    expect(search('split zebra')[0]).toMatchObject({ slug: 'workspace' });
  });

  it('breaks a tie in score by the article order', () => {
    const twin = (slug: string, order: number) =>
      parseArticle(
        slug,
        `---\ntitle: Twin ${slug}\norder: ${order}\nsummary: s\n---\nShared zebra text.\n`,
      );
    const hits = createHelpSearch([twin('b', 20), twin('a', 10)])('zebra');
    expect(hits.map((h) => h.slug)).toEqual(['a', 'b']);
  });

  it('honors the limit', () => {
    expect(search('the', 1)).toHaveLength(1);
  });
});

describe('makeSnippet', () => {
  const text = `${'Lorem ipsum dolor sit amet. '.repeat(10)}The master password unlocks it. ${'More words here. '.repeat(10)}`;

  it('centers a window on the first match with ellipses on cut ends', () => {
    const snippet = makeSnippet(text, ['master'], 80);
    expect(snippet).toContain('master password');
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(84);
  });

  it('starts at the beginning when nothing matches', () => {
    const snippet = makeSnippet(text, ['zebra'], 40);
    expect(snippet.startsWith('Lorem')).toBe(true);
  });

  it('keeps the start of the text when the match is near it', () => {
    const snippet = makeSnippet(
      `Master key first. ${'filler words here. '.repeat(20)}`,
      ['master'],
      80,
    );
    expect(snippet.startsWith('Master key')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('keeps the end of the text when the match is near it', () => {
    const snippet = makeSnippet(
      `${'filler words here. '.repeat(20)}The very last word.`,
      ['last'],
      80,
    );
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('The very last word.')).toBe(true);
  });

  it('centers on whichever term appears first', () => {
    const snippet = makeSnippet(
      `${'a '.repeat(60)}beta ${'b '.repeat(60)}alpha ${'c '.repeat(60)}`,
      ['alpha', 'beta'],
      40,
    );
    expect(snippet).toContain('beta');
    expect(snippet).not.toContain('alpha');
  });

  it('cuts text with no spaces at the window edges', () => {
    const snippet = makeSnippet(`${'x'.repeat(100)}/needle/${'y'.repeat(100)}`, ['needle'], 40);
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(42);
  });

  it('returns short text untouched', () => {
    expect(makeSnippet('Short text', ['short'], 80)).toBe('Short text');
  });
});

describe('highlightRanges', () => {
  it('marks words that start with a query term, merged and in order', () => {
    expect(highlightRanges('Split the pane, panes split', ['pane', 'split'])).toEqual([
      [0, 5],
      [10, 14],
      [16, 20],
      [22, 27],
    ]);
  });

  it('marks nothing without terms', () => {
    expect(highlightRanges('anything', [])).toEqual([]);
  });
});
