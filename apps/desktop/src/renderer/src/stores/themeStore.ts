import { create } from 'zustand';
import type { ThemeMode } from '@agentmat/core';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

function resolveIsDark(theme: ThemeMode): boolean {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return theme === 'dark';
}

function applyThemeClass(theme: ThemeMode): void {
  document.documentElement.classList.toggle('dark', resolveIsDark(theme));
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
