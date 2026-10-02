import { describe, expect, it } from 'vitest';
import { comboToOps, normalizeKeyName, scancodeFor } from './rdpKeys';

describe('scancodeFor', () => {
  it('maps letters to their set 1 scancodes', () => {
    expect(scancodeFor('a')).toBe(0x1e);
    expect(scancodeFor('q')).toBe(0x10);
    expect(scancodeFor('z')).toBe(0x2c);
    expect(scancodeFor('m')).toBe(0x32);
    expect(scancodeFor('l')).toBe(0x26);
  });

  it('maps the digit row, with 0 after 9', () => {
    expect(scancodeFor('1')).toBe(0x02);
    expect(scancodeFor('9')).toBe(0x0a);
    expect(scancodeFor('0')).toBe(0x0b);
  });

  it('maps the function keys, where f11 and f12 are not after f10', () => {
    expect(scancodeFor('f1')).toBe(0x3b);
    expect(scancodeFor('f4')).toBe(0x3e);
    expect(scancodeFor('f10')).toBe(0x44);
    expect(scancodeFor('f11')).toBe(0x57);
    expect(scancodeFor('f12')).toBe(0x58);
  });

  it('maps the common control keys', () => {
    expect(scancodeFor('enter')).toBe(0x1c);
    expect(scancodeFor('esc')).toBe(0x01);
    expect(scancodeFor('tab')).toBe(0x0f);
    expect(scancodeFor('space')).toBe(0x39);
    expect(scancodeFor('backspace')).toBe(0x0e);
    expect(scancodeFor('ctrl')).toBe(0x1d);
    expect(scancodeFor('shift')).toBe(0x2a);
    expect(scancodeFor('alt')).toBe(0x38);
    expect(scancodeFor('capslock')).toBe(0x3a);
  });

  it('maps punctuation by name and by character', () => {
    const pairs: [string, string, number][] = [
      ['minus', '-', 0x0c],
      ['equals', '=', 0x0d],
      ['leftbracket', '[', 0x1a],
      ['rightbracket', ']', 0x1b],
      ['semicolon', ';', 0x27],
      ['quote', "'", 0x28],
      ['backquote', '`', 0x29],
      ['backslash', '\\', 0x2b],
      ['comma', ',', 0x33],
      ['period', '.', 0x34],
      ['slash', '/', 0x35],
    ];
    for (const [name, char, code] of pairs) {
      expect(scancodeFor(name), name).toBe(code);
      expect(scancodeFor(char), char).toBe(code);
    }
  });

  it('gives extended keys one number with 0xE0 in the high byte', () => {
    expect(scancodeFor('win')).toBe(0xe05b);
    expect(scancodeFor('delete')).toBe(0xe053);
    expect(scancodeFor('insert')).toBe(0xe052);
    expect(scancodeFor('home')).toBe(0xe047);
    expect(scancodeFor('end')).toBe(0xe04f);
    expect(scancodeFor('pageup')).toBe(0xe049);
    expect(scancodeFor('pagedown')).toBe(0xe051);
    expect(scancodeFor('up')).toBe(0xe048);
    expect(scancodeFor('down')).toBe(0xe050);
    expect(scancodeFor('left')).toBe(0xe04b);
    expect(scancodeFor('right')).toBe(0xe04d);
    expect(scancodeFor('rctrl')).toBe(0xe01d);
    expect(scancodeFor('ralt')).toBe(0xe038);
    expect(scancodeFor('menu')).toBe(0xe05d);
  });

  it('accepts the usual aliases, in any case', () => {
    for (const name of ['cmd', 'meta', 'super', 'windows', 'WIN', 'Cmd']) {
      expect(scancodeFor(name), name).toBe(0xe05b);
    }
    expect(scancodeFor('control')).toBe(0x1d);
    expect(scancodeFor('del')).toBe(0xe053);
    expect(scancodeFor('return')).toBe(0x1c);
    expect(scancodeFor('escape')).toBe(0x01);
    expect(scancodeFor('pgup')).toBe(0xe049);
    expect(scancodeFor('pgdn')).toBe(0xe051);
    expect(scancodeFor('Enter')).toBe(0x1c);
    expect(scancodeFor(' tab ')).toBe(0x0f);
  });

  it('returns null for a key it does not know', () => {
    expect(scancodeFor('hyper')).toBeNull();
    expect(scancodeFor('')).toBeNull();
    expect(scancodeFor('f13')).toBeNull();
    expect(scancodeFor('ctrl+s')).toBeNull();
  });
});

describe('normalizeKeyName', () => {
  it('resolves aliases to one name', () => {
    expect(normalizeKeyName('Windows')).toBe('win');
    expect(normalizeKeyName('CONTROL')).toBe('ctrl');
    expect(normalizeKeyName('Del')).toBe('delete');
    expect(normalizeKeyName('escape')).toBe('esc');
  });

  it('leaves an unknown name lowercased', () => {
    expect(normalizeKeyName('Hyper')).toBe('hyper');
  });
});

describe('comboToOps', () => {
  it('presses a single key and lets it go', () => {
    expect(comboToOps('enter')).toEqual([
      { kind: 'key', scancode: 0x1c, down: true },
      { kind: 'key', scancode: 0x1c, down: false },
    ]);
  });

  it('presses keys in order and releases them in reverse', () => {
    expect(comboToOps('ctrl+shift+esc')).toEqual([
      { kind: 'key', scancode: 0x1d, down: true },
      { kind: 'key', scancode: 0x2a, down: true },
      { kind: 'key', scancode: 0x01, down: true },
      { kind: 'key', scancode: 0x01, down: false },
      { kind: 'key', scancode: 0x2a, down: false },
      { kind: 'key', scancode: 0x1d, down: false },
    ]);
  });

  it('is case-insensitive and tolerates spaces around the plus', () => {
    expect(comboToOps('Ctrl + S')).toEqual(comboToOps('ctrl+s'));
    expect(comboToOps('Cmd+R')).toEqual([
      { kind: 'key', scancode: 0xe05b, down: true },
      { kind: 'key', scancode: 0x13, down: true },
      { kind: 'key', scancode: 0x13, down: false },
      { kind: 'key', scancode: 0xe05b, down: false },
    ]);
  });

  it('returns null when any key is unknown or the combo is empty', () => {
    expect(comboToOps('ctrl+hyper')).toBeNull();
    expect(comboToOps('')).toBeNull();
    expect(comboToOps('ctrl+')).toBeNull();
  });
});
