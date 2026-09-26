import { describe, expect, it } from 'vitest';
import { fitViewport, VIEWPORT_PRESETS, viewportPreset } from './viewportPresets';

describe('viewport presets', () => {
  it('offers responsive first, then phone, tablet and desktop sizes', () => {
    expect(VIEWPORT_PRESETS.map((preset) => preset.id)).toEqual([
      'responsive',
      'mobile',
      'tablet',
      'desktop',
    ]);
  });

  it('falls back to responsive for an unknown id', () => {
    expect(viewportPreset('watch' as never).id).toBe('responsive');
  });
});

describe('fitViewport', () => {
  const pane = { width: 1000, height: 700 };

  it('fills the pane when responsive', () => {
    expect(fitViewport('responsive', pane)).toEqual({ width: 1000, height: 700, scale: 1 });
  });

  it('shows a phone at its own size when it fits', () => {
    expect(fitViewport('mobile', { width: 1000, height: 900 })).toEqual({
      width: 390,
      height: 844,
      scale: 1,
    });
  });

  it('scales a device down to fit the pane, keeping its shape', () => {
    const fit = fitViewport('desktop', pane);
    expect(fit.width).toBe(1440);
    expect(fit.height).toBe(900);
    expect(fit.scale).toBeCloseTo(1000 / 1440);
  });

  it('uses the tighter of the two sides', () => {
    const fit = fitViewport('tablet', pane);
    expect(fit.scale).toBeCloseTo(700 / 1180);
  });

  it('never scales below a floor when the pane collapses', () => {
    expect(fitViewport('desktop', { width: 0, height: 0 }).scale).toBe(0.25);
  });
});
