import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEmuAvdName, parseEmuOk } from './adbConsole.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf-8');

describe('parseEmuAvdName', () => {
  it('reads the name and drops the trailing OK', () => {
    // Every `adb emu` command answers with its result then a bare OK, which is not the answer.
    expect(parseEmuAvdName(fixture('emu-avd-name.txt'))).toBe('Pixel_7_API_34');
  });

  it('returns null when the console refuses or says nothing', () => {
    expect(parseEmuAvdName('KO: unknown command\n')).toBeNull();
    expect(parseEmuAvdName('OK\n')).toBeNull();
    expect(parseEmuAvdName('')).toBeNull();
  });
});

describe('parseEmuOk', () => {
  it('is true only when the console acknowledges', () => {
    expect(parseEmuOk('OK\n')).toBe(true);
    expect(parseEmuOk('Pixel_7_API_34\nOK\n')).toBe(true);
    expect(parseEmuOk('KO: bad command\n')).toBe(false);
    expect(parseEmuOk('')).toBe(false);
  });
});
