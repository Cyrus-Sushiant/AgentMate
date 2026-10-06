import { describe, expect, it } from 'vitest';
import { parseArticle } from '../../shared/help/parse';
import { chunkArticles } from './chunker';

const article = parseArticle(
  'vault',
  `---
title: Vault
category: Connect
summary: Keep secrets encrypted.
keywords: secrets
---
The Vault keeps your secrets.

## Unlock the vault

Type your **master password**.

### Forgot it

There is no recovery.
`,
);

describe('chunkArticles', () => {
  it('makes one chunk per section, named by where it sits in the article', () => {
    const chunks = chunkArticles([article]);
    expect(chunks.map((c) => [c.id, c.anchor, c.heading])).toEqual([
      ['vault#intro#0', '', ''],
      ['vault#unlock-the-vault#0', 'unlock-the-vault', 'Unlock the vault'],
      ['vault#forgot-it#0', 'forgot-it', 'Forgot it'],
    ]);
    expect(chunks[0]?.text).toBe('Vault\nKeep secrets encrypted.\n\nThe Vault keeps your secrets.');
    expect(chunks[1]?.text).toBe('Vault > Unlock the vault\n\nType your master password.');
    expect(chunks[2]?.text).toBe('Vault > Unlock the vault > Forgot it\n\nThere is no recovery.');
    expect(chunks.every((c) => c.slug === 'vault' && c.articleTitle === 'Vault')).toBe(true);
  });

  it('hashes the text so an unchanged chunk keeps its hash', () => {
    const [a] = chunkArticles([article]);
    const [b] = chunkArticles([article]);
    expect(a?.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(a?.hash).toBe(b?.hash);
  });

  it('splits a long section on line breaks with one line of overlap', () => {
    const lines = Array.from({ length: 12 }, (_, i) => `Line ${i} ${'word '.repeat(15)}`.trim());
    const long = parseArticle('long', `---\ntitle: Long\n---\n## Big\n\n${lines.join('\n')}\n`);
    const chunks = chunkArticles([long], 400);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.map((c) => c.id)).toEqual(chunks.map((_, i) => `long#big#${i}`));
    for (const chunk of chunks) {
      expect(chunk.text.startsWith('Long > Big\n\n')).toBe(true);
      expect(chunk.text.length).toBeLessThanOrEqual(400 + 120);
    }
    // The last line of one chunk opens the next, so no step is cut off from its context.
    const lastOfFirst = chunks[0]!.text.split('\n').at(-1)!;
    expect(chunks[1]!.text.split('\n')[2]).toBe(lastOfFirst);
  });

  it('skips sections with no text', () => {
    const empty = parseArticle('e', '---\ntitle: E\n---\n## Empty\n\n## Full\n\nText\n');
    expect(chunkArticles([empty]).map((c) => c.anchor)).toEqual(['full']);
  });
});
