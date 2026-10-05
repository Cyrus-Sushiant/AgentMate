import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The promise is cached for the life of the module, which is the point of it, so each case
 * loads its own copy.
 */
type FontReady = typeof import('./fontReady');

async function load(): Promise<FontReady> {
  vi.resetModules();
  return import('./fontReady');
}

interface FakeFontFaceSet {
  add?: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  ready: Promise<unknown>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function installFonts(fonts: FakeFontFaceSet | undefined): void {
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
}

function fakeFonts(patch: Partial<FakeFontFaceSet> = {}): FakeFontFaceSet {
  const listeners = new Map<string, Set<() => void>>();
  return {
    load: vi.fn(async () => []),
    ready: Promise.resolve(),
    addEventListener: vi.fn((type: string, listener: () => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    }),
    removeEventListener: vi.fn((type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    }),
    ...patch,
  };
}

afterEach(() => {
  installFonts(undefined);
});

describe('whenTerminalFontReady', () => {
  it('asks for the terminal face and waits for the page to finish loading fonts', async () => {
    const fonts = fakeFonts();
    installFonts(fonts);
    const { whenTerminalFontReady } = await load();
    await whenTerminalFontReady();
    // Measuring a fallback face sizes the grid wider than what gets drawn.
    expect(fonts.load).toHaveBeenCalledWith("13px 'Cascadia Code'");
  });

  it('waits only once, however many terminals open', async () => {
    const fonts = fakeFonts();
    installFonts(fonts);
    const { whenTerminalFontReady } = await load();
    const first = whenTerminalFontReady();
    expect(whenTerminalFontReady()).toBe(first);
    await first;
    await whenTerminalFontReady();
    expect(fonts.load).toHaveBeenCalledTimes(1);
  });

  it('resolves anyway when the font fails to load', async () => {
    // The fallback face measures correctly, so a failed load must not stall every terminal.
    installFonts(fakeFonts({ load: vi.fn(async () => Promise.reject(new Error('offline'))) }));
    const { whenTerminalFontReady } = await load();
    await expect(whenTerminalFontReady()).resolves.toBeUndefined();
  });

  it('resolves in a browser with no font loading API at all', async () => {
    installFonts(undefined);
    const { whenTerminalFontReady } = await load();
    await expect(whenTerminalFontReady()).resolves.toBeUndefined();
  });
});

describe('onFontsLoaded', () => {
  it('refits whenever the page finishes loading fonts', async () => {
    const fonts = fakeFonts();
    installFonts(fonts);
    const { onFontsLoaded } = await load();
    const refit = vi.fn();
    onFontsLoaded(refit);
    expect(fonts.addEventListener).toHaveBeenCalledWith('loadingdone', expect.any(Function));
    // A font that lands later changes the cell size, so the grid has to be measured again.
    const handler = fonts.addEventListener.mock.calls[0][1] as () => void;
    handler();
    expect(refit).toHaveBeenCalledTimes(1);
  });

  it('stops listening when its cleanup runs', async () => {
    const fonts = fakeFonts();
    installFonts(fonts);
    const { onFontsLoaded } = await load();
    const cleanup = onFontsLoaded(vi.fn());
    cleanup();
    expect(fonts.removeEventListener).toHaveBeenCalledWith('loadingdone', expect.any(Function));
  });

  it('hands back a harmless cleanup when there is no font API', async () => {
    installFonts(undefined);
    const { onFontsLoaded } = await load();
    const refit = vi.fn();
    expect(() => onFontsLoaded(refit)()).not.toThrow();
    expect(refit).not.toHaveBeenCalled();
  });
});

describe('addTerminalRtlFont', () => {
  class FakeFontFace {
    constructor(
      readonly family: string,
      readonly source: string,
      readonly descriptors: FontFaceDescriptors,
    ) {}
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds Vazirmatn for Persian and Arabic letters only, so Latin keeps the terminal face', async () => {
    const fonts = fakeFonts({ add: vi.fn() });
    installFonts(fonts);
    vi.stubGlobal('FontFace', FakeFontFace);
    const { addTerminalRtlFont, TERMINAL_RTL_FONT } = await load();
    addTerminalRtlFont();

    expect(fonts.add).toHaveBeenCalledTimes(1);
    const face = fonts.add?.mock.calls[0][0] as FakeFontFace;
    expect(face.family).toBe(TERMINAL_RTL_FONT);
    expect(face.source).toMatch(/vazirmatn-arabic-wght-normal.*\.woff2/);
    // The zero-width non-joiner has to come from the same face as the letters it separates.
    expect(face.descriptors.unicodeRange).toContain('U+0600-06FF');
    expect(face.descriptors.unicodeRange).toContain('U+200C');
    expect(face.descriptors.unicodeRange).not.toContain('U+0000');
    expect(face.descriptors.weight).toBe('100 900');
  });

  it('adds the face once, however many terminals open', async () => {
    const fonts = fakeFonts({ add: vi.fn() });
    installFonts(fonts);
    vi.stubGlobal('FontFace', FakeFontFace);
    const { addTerminalRtlFont } = await load();
    addTerminalRtlFont();
    addTerminalRtlFont();
    expect(fonts.add).toHaveBeenCalledTimes(1);
  });

  it('does nothing in a browser with no font loading API', async () => {
    installFonts(undefined);
    const { addTerminalRtlFont } = await load();
    expect(() => addTerminalRtlFont()).not.toThrow();
  });
});
