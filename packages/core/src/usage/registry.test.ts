import { describe, expect, it } from 'vitest';
import {
  ALL_AGENTS_PROVIDER,
  ALL_AGENTS_WIDGET_ID,
  getUsageProvider,
  isAutoConnected,
  isLiveProvider,
  USAGE_PROVIDER_REGISTRY,
} from './registry.js';
import type { UsageDataSource, UsageProviderCategory } from './types.js';

/**
 * Every Usage card, widget and settings row is keyed by a provider id from this list,
 * so a duplicate id would make two cards fight over one settings entry, and a missing
 * accent color would render the monogram logo invisible.
 */

const DATA_SOURCES: UsageDataSource[] = ['local-log', 'local-session', 'api-key', 'unsupported'];

const CATEGORIES: UsageProviderCategory[] = [
  'coding-agent',
  'api-provider',
  'ide',
  'router',
  'cloud',
  'audio',
  'other',
];

describe('USAGE_PROVIDER_REGISTRY invariants', () => {
  it('is populated', () => {
    expect(USAGE_PROVIDER_REGISTRY.length).toBeGreaterThan(0);
  });

  it('has unique ids, which double as the settings and widget keys', () => {
    const ids = USAGE_PROVIDER_REGISTRY.map((p) => p.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicates).toEqual([]);
  });

  it('has unique names, so the picker never shows the same row twice', () => {
    const names = USAGE_PROVIDER_REGISTRY.map((p) => p.name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    expect(duplicates).toEqual([]);
  });

  it('uses kebab-case ids', () => {
    for (const provider of USAGE_PROVIDER_REGISTRY) {
      expect(provider.id, provider.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('never reuses the all-agents sentinel id', () => {
    expect(USAGE_PROVIDER_REGISTRY.some((p) => p.id === ALL_AGENTS_WIDGET_ID)).toBe(false);
  });

  it('gives every provider a name, a known category and a known data source', () => {
    for (const provider of USAGE_PROVIDER_REGISTRY) {
      expect(provider.name.trim(), provider.id).not.toBe('');
      expect(CATEGORIES, provider.id).toContain(provider.category);
      expect(DATA_SOURCES, provider.id).toContain(provider.dataSource);
    }
  });

  it('gives every provider a 6-digit hex accent for the monogram logo', () => {
    for (const provider of USAGE_PROVIDER_REGISTRY) {
      expect(provider.accentColor, provider.id).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('uses http(s) for every homepage link', () => {
    for (const provider of USAGE_PROVIDER_REGISTRY) {
      if (!provider.homepageUrl) continue;
      expect(provider.homepageUrl, provider.id).toMatch(/^https?:\/\/\S+$/);
    }
  });

  it('claims cost support on every credential-free provider, which is where cost is derived', () => {
    // A few `unsupported` entries also claim it, as a note about the integration still
    // to be wired, so the rule only runs the other way round.
    for (const provider of USAGE_PROVIDER_REGISTRY) {
      if (!isAutoConnected(provider)) continue;
      expect(provider.supportsCost, provider.id).toBe(true);
    }
  });

  it('only hints at a key for a provider that actually takes one', () => {
    for (const provider of USAGE_PROVIDER_REGISTRY) {
      if (!provider.keyHint) continue;
      expect(provider.keyHint.trim(), provider.id).not.toBe('');
      expect(provider.dataSource, provider.id).toBe('api-key');
    }
  });

  it('has at least one live provider, or the Usage page would be entirely empty states', () => {
    expect(USAGE_PROVIDER_REGISTRY.some(isLiveProvider)).toBe(true);
  });
});

describe('ALL_AGENTS_PROVIDER', () => {
  it('is the sentinel used by the combined widget and chart', () => {
    expect(ALL_AGENTS_PROVIDER.id).toBe(ALL_AGENTS_WIDGET_ID);
    expect(ALL_AGENTS_PROVIDER.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('getUsageProvider', () => {
  it('finds every registered provider by id', () => {
    for (const provider of USAGE_PROVIDER_REGISTRY) {
      expect(getUsageProvider(provider.id), provider.id).toBe(provider);
    }
  });

  it('resolves the all-agents sentinel, which is not in the list itself', () => {
    expect(getUsageProvider(ALL_AGENTS_WIDGET_ID)).toBe(ALL_AGENTS_PROVIDER);
  });

  it('returns undefined for an unknown or empty id', () => {
    expect(getUsageProvider('no-such-provider')).toBeUndefined();
    expect(getUsageProvider('')).toBeUndefined();
  });
});

describe('isLiveProvider', () => {
  it('is true for anything but an unwired provider', () => {
    for (const provider of USAGE_PROVIDER_REGISTRY) {
      expect(isLiveProvider(provider), provider.id).toBe(provider.dataSource !== 'unsupported');
    }
  });
});

describe('isAutoConnected', () => {
  it('covers the sources that need nothing from the user', () => {
    for (const provider of USAGE_PROVIDER_REGISTRY) {
      const expected =
        provider.dataSource === 'local-log' || provider.dataSource === 'local-session';
      expect(isAutoConnected(provider), provider.id).toBe(expected);
    }
  });

  it('never marks a key-based provider as auto-connected, since there is a key to paste', () => {
    for (const provider of USAGE_PROVIDER_REGISTRY) {
      if (provider.dataSource !== 'api-key') continue;
      expect(isAutoConnected(provider), provider.id).toBe(false);
    }
  });

  it('implies live, since a card with nothing to connect must have somewhere to read from', () => {
    for (const provider of USAGE_PROVIDER_REGISTRY) {
      if (!isAutoConnected(provider)) continue;
      expect(isLiveProvider(provider), provider.id).toBe(true);
    }
  });
});
