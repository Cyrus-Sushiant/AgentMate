import type { ThemeMode } from '@agentmat/core';
import { create } from 'zustand';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

export function resolveTheme(theme: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark ? 'dark' : 'light';
  return theme;
}

/** The `<html>` classes a resolved theme applies. `.dark` alone drives Tailwind's `dark:`
 * variant and every existing boolean ("is this dark?") consumer; the second class only
 * scopes the CSS variable overrides specific to that theme (see index.css). */
export function themeClassName(resolved: ResolvedTheme): string {
  switch (resolved) {
    case 'light':
      return '';
    case 'dark':
      return 'dark';
    case 'vscode-dark':
      return 'dark theme-vscode-dark';
    case 'vs2026':
      return 'dark theme-vs2026';
  }
}

export function resolveIsDark(theme: ThemeMode, systemPrefersDark: boolean): boolean {
  return resolveTheme(theme, systemPrefersDark) !== 'light';
}

function applyThemeClass(theme: ThemeMode): void {
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = resolveTheme(theme, systemPrefersDark);
  const root = document.documentElement;
  root.classList.remove('dark', 'theme-vscode-dark', 'theme-vs2026');
  const next = themeClassName(resolved);
  if (next) root.classList.add(...next.split(' '));
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  setTheme: (theme) => {
    applyThemeClass(theme);
    set({ theme });
    void window.agentmat.settings.update({ theme });
  },
}));

export async function initTheme(): Promise<void> {
  const settings = await window.agentmat.settings.get();
  applyThemeClass(settings.theme);
  useThemeStore.setState({ theme: settings.theme });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().theme === 'system') applyThemeClass('system');
  });
}
