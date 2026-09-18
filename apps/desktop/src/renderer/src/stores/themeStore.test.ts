import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type FakeBridge, installAgentmatBridge } from '../../../test/renderer/agentmatBridge';
import {
  initTheme,
  resolveIsDark,
  resolveTheme,
  themeClassName,
  useThemeStore,
} from './themeStore';

/** A controllable stand-in for the prefers-color-scheme query. */
const media = {
  matches: false,
  listeners: new Set<() => void>(),
  emit(matches: boolean): void {
    media.matches = matches;
    for (const listener of [...media.listeners]) listener();
  },
};

const realMatchMedia = window.matchMedia;
let bridge: FakeBridge;

function classes(): string[] {
  return [...document.documentElement.classList];
}

beforeEach(() => {
  media.matches = false;
  media.listeners.clear();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return media.matches;
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => media.listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        media.listeners.delete(listener),
    }),
  });
  document.documentElement.className = '';
  bridge = installAgentmatBridge({ 'settings.get': async () => ({ theme: 'system' }) });
  useThemeStore.setState({ theme: 'system' });
});

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: realMatchMedia,
  });
  document.documentElement.className = '';
});

describe('resolveTheme', () => {
  it('follows the system only for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('vscode-dark', false)).toBe('vscode-dark');
  });
});

describe('themeClassName', () => {
  it('puts no class on the page for the light theme', () => {
    expect(themeClassName('light')).toBe('');
  });

  it('uses .dark alone for the plain dark theme', () => {
    // That class is what drives Tailwind's dark: variant and every "is this dark?" consumer.
    expect(themeClassName('dark')).toBe('dark');
  });

  it('adds a second class for the editor themes, which only override variables', () => {
    expect(themeClassName('vscode-dark')).toBe('dark theme-vscode-dark');
    expect(themeClassName('vs2026')).toBe('dark theme-vs2026');
  });
});

describe('resolveIsDark', () => {
  it('counts every theme but light as dark', () => {
    expect(resolveIsDark('light', true)).toBe(false);
    expect(resolveIsDark('dark', false)).toBe(true);
    expect(resolveIsDark('vscode-dark', false)).toBe(true);
    expect(resolveIsDark('vs2026', false)).toBe(true);
    expect(resolveIsDark('system', false)).toBe(false);
    expect(resolveIsDark('system', true)).toBe(true);
  });
});

describe('setTheme', () => {
  it('paints the page, remembers the choice and saves it', () => {
    useThemeStore.getState().setTheme('vs2026');
    expect(classes()).toEqual(['dark', 'theme-vs2026']);
    expect(useThemeStore.getState().theme).toBe('vs2026');
    expect(bridge.$fn('settings.update')).toHaveBeenCalledWith({ theme: 'vs2026' });
  });

  it('takes the classes of the previous theme off again', () => {
    useThemeStore.getState().setTheme('vscode-dark');
    useThemeStore.getState().setTheme('light');
    expect(classes()).toEqual([]);
    useThemeStore.getState().setTheme('dark');
    expect(classes()).toEqual(['dark']);
  });

  it('reads the system preference for "system"', () => {
    media.matches = true;
    useThemeStore.getState().setTheme('system');
    expect(classes()).toEqual(['dark']);
  });
});

describe('initTheme', () => {
  it('paints and stores whatever was saved in settings', async () => {
    installAgentmatBridge({ 'settings.get': async () => ({ theme: 'vscode-dark' }) });
    await initTheme();
    expect(useThemeStore.getState().theme).toBe('vscode-dark');
    expect(classes()).toEqual(['dark', 'theme-vscode-dark']);
  });

  it('repaints when the system flips while the app is on "system"', async () => {
    await initTheme();
    expect(classes()).toEqual([]);
    media.emit(true);
    expect(classes()).toEqual(['dark']);
  });

  it('ignores a system flip once a theme has been chosen outright', async () => {
    await initTheme();
    useThemeStore.getState().setTheme('light');
    media.emit(true);
    expect(classes()).toEqual([]);
  });
});
