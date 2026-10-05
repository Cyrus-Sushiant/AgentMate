import { afterEach, describe, expect, it } from 'vitest';
import { applyWindowGlass, windowGlassFromSearch } from './windowGlass';

describe('windowGlassFromSearch', () => {
  it('reads the materials main can put under the window', () => {
    expect(windowGlassFromSearch('?glass=mica')).toBe('mica');
    expect(windowGlassFromSearch('?glass=vibrancy')).toBe('vibrancy');
  });

  it('ignores none, a missing parameter and anything unexpected', () => {
    expect(windowGlassFromSearch('?glass=none')).toBeUndefined();
    expect(windowGlassFromSearch('')).toBeUndefined();
    expect(windowGlassFromSearch('?theme=dark')).toBeUndefined();
    expect(windowGlassFromSearch('?glass=acrylic')).toBeUndefined();
  });
});

describe('applyWindowGlass', () => {
  const root = document.documentElement;

  afterEach(() => {
    delete root.dataset.glass;
  });

  it('marks <html> when the window sits on mica', () => {
    applyWindowGlass(root, '?glass=mica');
    expect(root.dataset.glass).toBe('mica');
    expect(root.getAttribute('data-glass')).toBe('mica');
  });

  it('leaves <html> unmarked for none', () => {
    applyWindowGlass(root, '?glass=none');
    expect(root.hasAttribute('data-glass')).toBe(false);
  });

  it('leaves <html> unmarked when the window loads without the parameter', () => {
    applyWindowGlass(root, '');
    expect(root.hasAttribute('data-glass')).toBe(false);
  });
});
