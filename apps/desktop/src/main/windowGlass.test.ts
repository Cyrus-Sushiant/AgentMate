import { describe, expect, it, vi } from 'vitest';
import { nativeTheme } from '../test/main/electronMock';
import { withPlatform } from '../test/main/fixtures';

const osState = vi.hoisted(() => ({ release: '10.0.22631' }));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, release: () => osState.release };
});

const { applyWindowTheme, glassWindowOptions, mainWindowGlass, supportsBackgroundMaterial } =
  await import('./windowGlass');

/** Runs `work` as if on `platform` with this OS release, the way os.release() reports it. */
function on<Result>(platform: NodeJS.Platform, release: string, work: () => Result) {
  osState.release = release;
  return withPlatform(platform, work);
}

describe('supportsBackgroundMaterial', () => {
  it('is on from Windows 11 22H2 (build 22621)', async () => {
    expect(await on('win32', '10.0.22621', supportsBackgroundMaterial)).toBe(true);
    expect(await on('win32', '10.0.26100', supportsBackgroundMaterial)).toBe(true);
  });

  it('is off on older Windows', async () => {
    expect(await on('win32', '10.0.22000', supportsBackgroundMaterial)).toBe(false);
    expect(await on('win32', '10.0.19045', supportsBackgroundMaterial)).toBe(false);
    expect(await on('win32', '6.1', supportsBackgroundMaterial)).toBe(false);
  });

  it('is off outside Windows, whatever the release number says', async () => {
    expect(await on('darwin', '24.0.22621', supportsBackgroundMaterial)).toBe(false);
    expect(await on('linux', '6.8.22621', supportsBackgroundMaterial)).toBe(false);
  });
});

describe('mainWindowGlass', () => {
  it('picks Mica on Windows 11 and falls back on older Windows', async () => {
    expect(await on('win32', '10.0.22631', mainWindowGlass)).toBe('mica');
    expect(await on('win32', '10.0.19045', mainWindowGlass)).toBe('none');
  });

  it('picks vibrancy on macOS and nothing on Linux', async () => {
    expect(await on('darwin', '24.0.0', mainWindowGlass)).toBe('vibrancy');
    expect(await on('linux', '6.8.0', mainWindowGlass)).toBe('none');
  });
});

describe('glassWindowOptions', () => {
  it('puts Mica behind a window that is never transparent', () => {
    const options = glassWindowOptions('mica', '#0a0a0a');
    expect(options).toEqual({ backgroundColor: '#00000000', backgroundMaterial: 'mica' });
    // Mica paints nothing on a transparent window, and transparency costs resize and maximize.
    expect('transparent' in options).toBe(false);
  });

  it('uses under-window vibrancy on macOS', () => {
    expect(glassWindowOptions('vibrancy', '#0a0a0a')).toEqual({
      backgroundColor: '#00000000',
      vibrancy: 'under-window',
      visualEffectState: 'active',
    });
  });

  it('keeps the theme color when there is no material', () => {
    expect(glassWindowOptions('none', '#181921')).toEqual({ backgroundColor: '#181921' });
  });
});

describe('applyWindowTheme', () => {
  it('maps every app theme onto the native one', () => {
    applyWindowTheme('light');
    expect(nativeTheme.themeSource).toBe('light');
    applyWindowTheme('system');
    expect(nativeTheme.themeSource).toBe('system');
    for (const dark of ['dark', 'vscode-dark', 'vs2026'] as const) {
      nativeTheme.themeSource = 'system';
      applyWindowTheme(dark);
      expect(nativeTheme.themeSource).toBe('dark');
    }
  });
});
