import { ipcMain } from 'electron';
import type {
  DesktopWidgetInstance,
  ProviderUsage,
  WidgetMode,
  WidgetSize,
  WidgetStyle,
} from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { SetUsageProviderConfigInput } from '../../shared/apiTypes';
import { store } from '../store';
import { clearUsageCache, getAllUsage, getProviderUsage } from '../usage';
import { widgetManager } from '../usage/widgetWindows';

export function registerUsageHandlers(): void {
  ipcMain.handle(IPC.usage.list, async (): Promise<ProviderUsage[]> => {
    const settings = await store.getSettings();
    return getAllUsage(settings.usageProviderConfigs ?? {});
  });

  ipcMain.handle(IPC.usage.get, async (_e, providerId: string): Promise<ProviderUsage> => {
    const settings = await store.getSettings();
    return getProviderUsage(providerId, settings.usageProviderConfigs?.[providerId]);
  });

  ipcMain.handle(IPC.usage.refresh, async (): Promise<ProviderUsage[]> => {
    clearUsageCache();
    const settings = await store.getSettings();
    return getAllUsage(settings.usageProviderConfigs ?? {}, true);
  });

  ipcMain.handle(
    IPC.usage.setProviderConfig,
    async (_e, input: SetUsageProviderConfigInput): Promise<void> => {
      const settings = await store.getSettings();
      const configs = { ...(settings.usageProviderConfigs ?? {}) };
      configs[input.providerId] = input.config;
      await store.setSettings({ ...settings, usageProviderConfigs: configs });
      clearUsageCache();
    },
  );

  // --- Desktop widget windows ---
  ipcMain.handle(IPC.usage.listWidgets, (): Promise<DesktopWidgetInstance[]> =>
    widgetManager.list(),
  );
  ipcMain.handle(IPC.usage.getWidget, (_e, id: string): Promise<DesktopWidgetInstance | null> =>
    widgetManager.get(id),
  );
  ipcMain.handle(
    IPC.usage.openWidget,
    (_e, providerId: string, size?: WidgetSize): Promise<DesktopWidgetInstance> =>
      widgetManager.open(providerId, size),
  );
  ipcMain.handle(IPC.usage.closeWidget, (_e, id: string): Promise<void> =>
    widgetManager.close(id),
  );
  ipcMain.handle(IPC.usage.setWidgetStyle, (_e, id: string, style: WidgetStyle): Promise<void> =>
    widgetManager.setStyle(id, style),
  );
  ipcMain.handle(IPC.usage.setWidgetSize, (_e, id: string, size: WidgetSize): Promise<void> =>
    widgetManager.setSize(id, size),
  );
  ipcMain.handle(IPC.usage.setWidgetMode, (_e, id: string, mode: WidgetMode): Promise<void> =>
    widgetManager.setMode(id, mode),
  );
}
