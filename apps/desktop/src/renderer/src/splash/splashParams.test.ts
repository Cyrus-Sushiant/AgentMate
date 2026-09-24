import { describe, expect, it } from 'vitest';
import { readSplashParams } from './splashParams';

describe('readSplashParams', () => {
  it('reads the theme, the glass mode and the build from the splash URL', () => {
    expect(readSplashParams('?theme=light&glass=native&version=1.48.0', 2026)).toEqual({
      theme: 'light',
      glass: 'native',
      credit: '© 2026 SmartClouds · v1.48.0',
    });
  });

  it('labels an unpackaged run as a dev build', () => {
    expect(readSplashParams('?version=dev', 2026).credit).toBe('© 2026 SmartClouds · Dev build');
  });

  it('falls back to the dark, CSS-drawn splash for missing or odd values', () => {
    expect(readSplashParams('?theme=sepia&glass=mica', 2027)).toEqual({
      theme: 'dark',
      glass: 'css',
      credit: '© 2027 SmartClouds',
    });
  });
});
