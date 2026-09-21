import { describe, expect, it } from 'vitest';
import { avdIdFromDisplayName, isValidAvdName } from './avdName.js';

describe('isValidAvdName', () => {
  it('accepts the names avdmanager accepts', () => {
    expect(isValidAvdName('Pixel_7_API_34')).toBe(true);
    expect(isValidAvdName('pixel-7')).toBe(true);
    expect(isValidAvdName('Tablet.33')).toBe(true);
  });

  it('rejects names avdmanager would refuse', () => {
    // A space is the common one: Studio allows it as a display name, avdmanager does not.
    expect(isValidAvdName('My Tablet')).toBe(false);
    expect(isValidAvdName('')).toBe(false);
    expect(isValidAvdName('   ')).toBe(false);
    expect(isValidAvdName('quote"name')).toBe(false);
    expect(isValidAvdName('semi;colon')).toBe(false);
    expect(isValidAvdName('slash/name')).toBe(false);
  });
});

describe('avdIdFromDisplayName', () => {
  it('turns a display name into an id avdmanager will take', () => {
    expect(avdIdFromDisplayName('My Tablet')).toBe('My_Tablet');
    expect(avdIdFromDisplayName('Pixel 7 (API 34)')).toBe('Pixel_7_API_34');
    expect(avdIdFromDisplayName('  spaced  out  ')).toBe('spaced_out');
  });

  it('never produces an invalid id', () => {
    for (const input of ['a/b', 'x"y', 'p;q', '!!!', '']) {
      const id = avdIdFromDisplayName(input);
      if (id !== '') expect(isValidAvdName(id)).toBe(true);
    }
  });
});
