import { describe, expect, it } from 'vitest';
import {
  HELP_CATEGORIES,
  parseArticle,
  parseFrontmatter,
  resolveHelpLink,
  slugifyHeading,
  splitSections,
  stripMarkdown,
} from './parse';

const SAMPLE = `---
title: Vault
category: Connect
order: 40
summary: Keep secrets encrypted on this computer.
keywords: secrets, passwords,  keys ,
route: /vault
---

The Vault keeps your secrets.

## Where to find it

Click **Vault** in the sidebar.

### Unlock the vault

1. Type your master password.

\`\`\`bash
## not a heading
\`\`\`

## Tips

- Lock it when you leave.
`;

describe('parseFrontmatter', () => {
  it('splits the key/value header from the body', () => {
    const { meta, body } = parseFrontmatter(SAMPLE);
    expect(meta).toMatchObject({ title: 'Vault', category: 'Connect', order: '40' });
    expect(body.startsWith('The Vault keeps your secrets.')).toBe(true);
  });

  it('treats a file without a header as all body', () => {
    expect(parseFrontmatter('Just text')).toEqual({ meta: {}, body: 'Just text' });
  });

  it('accepts Windows line endings', () => {
    const { meta, body } = parseFrontmatter('---\r\ntitle: A\r\n---\r\nBody\r\n');
    expect(meta.title).toBe('A');
    expect(body).toBe('Body\n');
  });

  it('ignores lines that are not key/value pairs', () => {
    expect(parseFrontmatter('---\nnot a pair\ntitle: A: B\n---\n').meta).toEqual({
      title: 'A: B',
    });
  });
});

describe('slugifyHeading', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(slugifyHeading('Where to find it')).toBe('where-to-find-it');
    expect(slugifyHeading('Settings: Providers & keys!')).toBe('settings-providers-keys');
  });

  it('drops markdown formatting', () => {
    expect(slugifyHeading('Use `Ctrl+K` and **bold**')).toBe('use-ctrl-k-and-bold');
  });

  it('keeps letters from other scripts', () => {
    expect(slugifyHeading('Café über')).toBe('café-über');
  });
});

describe('stripMarkdown', () => {
  it('turns markdown into readable plain text', () => {
    const text = stripMarkdown(
      '> [!TIP]\n> Press **Save** or see [Vault](vault.md).\n\n- `Ctrl+S` saves\n1. Step',
    );
    expect(text).toBe('Press Save or see Vault.\nCtrl+S saves\nStep');
  });

  it('keeps the text of tables without the pipes and rulers', () => {
    expect(stripMarkdown('| Key | Action |\n| --- | --- |\n| `F1` | Help |')).toBe(
      'Key Action\nF1 Help',
    );
  });
});

describe('splitSections', () => {
  it('cuts the body at level 2 and 3 headings, ignoring code fences', () => {
    const { body } = parseFrontmatter(SAMPLE);
    const sections = splitSections(body);
    expect(sections.map((s) => [s.level, s.id, s.heading])).toEqual([
      [0, '', ''],
      [2, 'where-to-find-it', 'Where to find it'],
      [3, 'unlock-the-vault', 'Unlock the vault'],
      [2, 'tips', 'Tips'],
    ]);
    expect(sections[2]?.markdown).toContain('## not a heading');
    expect(sections[2]?.parent).toBe('Where to find it');
    expect(sections[1]?.parent).toBeUndefined();
  });

  it('numbers repeated headings so every anchor stays unique', () => {
    const sections = splitSections('## Steps\na\n## Steps\nb\n');
    expect(sections.map((s) => s.id)).toEqual(['steps', 'steps-1']);
  });

  it('leaves out an empty intro', () => {
    expect(splitSections('## Only\ntext').map((s) => s.id)).toEqual(['only']);
  });
});

describe('parseArticle', () => {
  it('builds a typed article from a markdown file', () => {
    const article = parseArticle('vault', SAMPLE);
    expect(article).toMatchObject({
      slug: 'vault',
      title: 'Vault',
      category: 'Connect',
      order: 40,
      summary: 'Keep secrets encrypted on this computer.',
      keywords: ['secrets', 'passwords', 'keys'],
      route: '/vault',
    });
    expect(article.sections).toHaveLength(4);
  });

  it('falls back to safe defaults for optional fields', () => {
    const article = parseArticle('x', '---\ntitle: X\ncategory: Nope\n---\nBody');
    expect(article).toMatchObject({ order: 999, keywords: [], summary: '', category: 'Nope' });
    expect(article.route).toBeUndefined();
  });

  it('refuses a file with no title', () => {
    expect(() => parseArticle('x', 'Body')).toThrow(/x\.md.*title/);
  });
});

describe('resolveHelpLink', () => {
  it('maps article links to a slug and anchor', () => {
    expect(resolveHelpLink('vault.md', 'settings')).toEqual({ slug: 'vault', anchor: '' });
    expect(resolveHelpLink('./settings.md#providers', 'x')).toEqual({
      slug: 'settings',
      anchor: 'providers',
    });
  });

  it('keeps same-page anchors on the current article', () => {
    expect(resolveHelpLink('#tips', 'vault')).toEqual({ slug: 'vault', anchor: 'tips' });
  });

  it('leaves outside links alone', () => {
    expect(resolveHelpLink('https://example.com/a.md', 'vault')).toBeNull();
    expect(resolveHelpLink('mailto:a@b.c', 'vault')).toBeNull();
    expect(resolveHelpLink(undefined, 'vault')).toBeNull();
  });
});

describe('HELP_CATEGORIES', () => {
  it('lists each category once', () => {
    expect(new Set(HELP_CATEGORIES).size).toBe(HELP_CATEGORIES.length);
    expect(HELP_CATEGORIES[0]).toBe('Getting started');
  });
});
