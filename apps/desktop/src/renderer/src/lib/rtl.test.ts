import { describe, expect, it } from 'vitest';
import { containsPersian, persianTextProps } from './rtl';

describe('containsPersian', () => {
  it('finds Persian script', () => {
    expect(containsPersian('سلام دنیا')).toBe(true);
    // Letters Persian adds on top of the Arabic block: pe, che, zhe, gaf.
    expect(containsPersian('پژگچ')).toBe(true);
  });

  it('finds Arabic punctuation and digits Persian text borrows', () => {
    expect(containsPersian('۱۲۳')).toBe(true);
    expect(containsPersian('؟')).toBe(true);
    expect(containsPersian('،')).toBe(true);
  });

  it('finds Persian mixed into Latin text', () => {
    expect(containsPersian('run تست now')).toBe(true);
  });

  it('leaves other scripts alone', () => {
    expect(containsPersian('')).toBe(false);
    expect(containsPersian('hello world')).toBe(false);
    // Hebrew is right-to-left too, but it is not in the range and has its own font.
    expect(containsPersian('שלום')).toBe(false);
    expect(containsPersian('日本語')).toBe(false);
    expect(containsPersian('123 !?')).toBe(false);
  });
});

describe('persianTextProps', () => {
  it('adds nothing for text with no Persian in it', () => {
    expect(persianTextProps('hello')).toEqual({});
  });

  it('turns the direction around and asks for the Persian face', () => {
    expect(persianTextProps('سلام')).toEqual({ dir: 'rtl', className: 'font-vazirmatn' });
  });
});
