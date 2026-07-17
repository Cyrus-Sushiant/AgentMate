import { ipcMain } from 'electron';
import type { AppSettings } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import { store } from '../store';

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.settings.get, (): Promise<AppSettings> => store.getSettings());

  ipcMain.handle(
    IPC.settings.update,
    async (_event, updates: Partial<AppSettings>): Promise<AppSettings> => {
      const current = await store.getSettings();
      const next = { ...current, ...updates };
      await store.setSettings(next);
      return next;
    },
  );
}
