import type { AppSettings } from '@agentmat/core';
import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import { clearGrammarCache } from '../grammar/languageToolClient';
import { stopLocalServer } from '../grammar/localServer';
import { applyProxySettings } from '../network/proxy';
import { petManager } from '../pet/petWindow';
import { store } from '../store';

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.settings.get, (): Promise<AppSettings> => store.getSettings());

  ipcMain.handle(
    IPC.settings.update,
    async (_event, updates: Partial<AppSettings>): Promise<AppSettings> => {
      const current = await store.getSettings();
      const next = { ...current, ...updates };
      await store.setSettings(next);
      void petManager.syncFromSettings();

      // Waited on rather than fired off, so the settings call only resolves
      // once the new route is the one the next request will take.
      if (updates.proxy) await applyProxySettings(next.proxy);

      // Cached check results are keyed by the settings they were produced with,
      // but the port or the picky level changing means the running server is the
      // wrong one to keep holding, so both are released here.
      if (updates.grammar) {
        clearGrammarCache();
        const wasLocal = current.grammar.source === 'local';
        const stillLocalOnSamePort =
          next.grammar.source === 'local' && next.grammar.localPort === current.grammar.localPort;
        if (wasLocal && !stillLocalOnSamePort) await stopLocalServer(current.grammar);
      }
      return next;
    },
  );
}
