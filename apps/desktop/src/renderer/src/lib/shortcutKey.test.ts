import { describe, expect, it } from 'vitest';
import { isShortcutLetter } from './shortcutKey';

const key = (fields: { key: string; code: string; keyCode: number }) => fields;

describe('isShortcutLetter', () => {
  it('matches a physical key on a Latin layout', () => {
    expect(isShortcutLetter(key({ key: 'v', code: 'KeyV', keyCode: 86 }), 'v')).toBe(true);
  });

  it('matches the physical key on a Farsi layout', () => {
    expect(isShortcutLetter(key({ key: 'ر', code: 'KeyV', keyCode: 86 }), 'v')).toBe(true);
  });

  it('matches the typed letter on a layout that moves keys around', () => {
    // Dvorak's V sits where QWERTY has a period.
    expect(isShortcutLetter(key({ key: 'v', code: 'Period', keyCode: 86 }), 'v')).toBe(true);
  });

  it('matches a synthesized key with no scan code by its virtual key', () => {
    // What Win+V's paste looked like in Electron on a Persian layout.
    expect(isShortcutLetter(key({ key: 'ر', code: '', keyCode: 86 }), 'v')).toBe(true);
    expect(isShortcutLetter(key({ key: 'ر', code: '', keyCode: 86 }), 'V')).toBe(true);
  });

  it('does not match other letters', () => {
    expect(isShortcutLetter(key({ key: 'c', code: 'KeyC', keyCode: 67 }), 'v')).toBe(false);
    expect(isShortcutLetter(key({ key: 'ز', code: '', keyCode: 67 }), 'v')).toBe(false);
  });

  it('ignores keyCode when a real scan code says it is another key', () => {
    expect(isShortcutLetter(key({ key: 'ر', code: 'KeyB', keyCode: 86 }), 'v')).toBe(false);
  });
});
