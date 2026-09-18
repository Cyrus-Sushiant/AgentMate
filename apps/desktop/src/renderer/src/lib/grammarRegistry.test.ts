import type { GrammarIssue } from '@shared/grammar';
import { describe, expect, it, vi } from 'vitest';
import type { FieldGrammar } from './grammarRegistry';
import { getFieldGrammar, registerFieldGrammar, unregisterFieldGrammar } from './grammarRegistry';

function entry(patch: Partial<FieldGrammar> = {}): FieldGrammar {
  return {
    issues: [],
    value: '',
    dismiss: vi.fn(),
    recheck: vi.fn(async (): Promise<GrammarIssue[]> => []),
    ...patch,
  };
}

describe('the field grammar registry', () => {
  it('has nothing for a field that never published', () => {
    expect(getFieldGrammar(document.createElement('textarea'))).toBeNull();
  });

  it('hands back what a field published, by the element itself', () => {
    // The writing menu is mounted once for the whole app and only knows the element that was
    // right-clicked, which is why the lookup is by element rather than by an id.
    const field = document.createElement('textarea');
    const published = entry({ value: 'teh cat' });
    registerFieldGrammar(field, published);
    expect(getFieldGrammar(field)).toBe(published);
  });

  it('keeps each field is entry apart', () => {
    const one = document.createElement('textarea');
    const two = document.createElement('input');
    const first = entry({ value: 'one' });
    const second = entry({ value: 'two' });
    registerFieldGrammar(one, first);
    registerFieldGrammar(two, second);
    expect(getFieldGrammar(one)).toBe(first);
    expect(getFieldGrammar(two)).toBe(second);
  });

  it('replaces an entry when the field publishes again', () => {
    const field = document.createElement('textarea');
    registerFieldGrammar(field, entry({ value: 'old' }));
    const fresh = entry({ value: 'new' });
    registerFieldGrammar(field, fresh);
    expect(getFieldGrammar(field)).toBe(fresh);
  });

  it('forgets a field that unmounted', () => {
    const field = document.createElement('textarea');
    registerFieldGrammar(field, entry());
    unregisterFieldGrammar(field);
    expect(getFieldGrammar(field)).toBeNull();
  });

  it('does not mind being asked to forget a field it never had', () => {
    expect(() => unregisterFieldGrammar(document.createElement('input'))).not.toThrow();
  });
});
