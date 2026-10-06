import { describe, expect, it } from 'vitest';
import { normalizeProjectWordPressLink } from './projectLink.js';

describe('normalizeProjectWordPressLink', () => {
  it('keeps valid items once each and drops the rest', () => {
    expect(
      normalizeProjectWordPressLink({
        siteId: 'site-1',
        linkedAt: '2026-10-05T10:00:00.000Z',
        items: [
          { kind: 'theme', slug: 'tt5' },
          { kind: 'theme', slug: 'tt5' },
          { kind: 'plugin', slug: '../x' },
          { kind: 'widget', slug: 'w' },
          null,
          { kind: 'mu-plugin', slug: 'loader.php' },
        ],
      }),
    ).toEqual({
      siteId: 'site-1',
      linkedAt: '2026-10-05T10:00:00.000Z',
      items: [
        { kind: 'theme', slug: 'tt5' },
        { kind: 'mu-plugin', slug: 'loader.php' },
      ],
    });
  });

  it('is undefined without a site or any usable item', () => {
    expect(normalizeProjectWordPressLink(undefined)).toBeUndefined();
    expect(
      normalizeProjectWordPressLink({ siteId: '-', items: [{ kind: 'theme', slug: 't' }] }),
    ).toBeUndefined();
    expect(normalizeProjectWordPressLink({ siteId: 's', items: 'x' })).toBeUndefined();
    expect(normalizeProjectWordPressLink({ siteId: 's', items: [] })).toBeUndefined();
  });

  it('falls back to the epoch for a missing or broken date', () => {
    expect(
      normalizeProjectWordPressLink({ siteId: 's', items: [{ kind: 'theme', slug: 't' }] })
        ?.linkedAt,
    ).toBe('1970-01-01T00:00:00.000Z');
  });
});
