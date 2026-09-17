import { describe, expect, it } from 'vitest';
import { classifySecretChars } from './secretChars';

describe('classifySecretChars', () => {
  it('groups runs of letters, digits, symbols and spaces', () => {
    expect(classifySecretChars('ab12!? x')).toEqual([
      { kind: 'letter', text: 'ab' },
      { kind: 'digit', text: '12' },
      { kind: 'symbol', text: '!?' },
      { kind: 'space', text: ' ' },
      { kind: 'letter', text: 'x' },
    ]);
  });

  it('treats non-Latin letters as letters and keeps emoji whole', () => {
    expect(classifySecretChars('رمز۹🔐')).toEqual([
      { kind: 'letter', text: 'رمز' },
      { kind: 'digit', text: '۹' },
      { kind: 'symbol', text: '🔐' },
    ]);
  });

  it('returns nothing for an empty string', () => {
    expect(classifySecretChars('')).toEqual([]);
  });
});
