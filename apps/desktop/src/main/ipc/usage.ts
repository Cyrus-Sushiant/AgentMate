import { ipcMain } from 'electron';
import type {
  DesktopWidgetInstance,
  ProviderUsage,
  UsageResetAlertSettings,
  UsageThresholdAlertSettings,
  WidgetMode,
  WidgetSize,
  WidgetStyle,
} from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { SetUsageProviderConfigInput } from '../../shared/apiTypes';
import { store } from '../store';
import { clearProviderUsageCache, clearUsageCache, getAllUsage, getProviderUsage } from '../usage';
import { widgetManager } from '../usage/widgetWindows';
import { refreshResetAlerts, sendResetAlertTest } from '../usage/resetAlerts';
import { sendThresholdAlertTest } from '../usage/thresholdAlerts';

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

  // --- Rate-limit reset alerts ---
  // Saved through here rather than settings.update so the watcher picks up the
  // new schedule immediately instead of on its next slow refresh.
  ipcMain.handle(
    IPC.usage.setResetAlerts,
    async (_e, alerts: UsageResetAlertSettings): Promise<void> => {
      const settings = await store.getSettings();
      await store.setSettings({ ...settings, usageResetAlerts: alerts });
      await refreshResetAlerts();
    },
  );

  ipcMain.handle(
    IPC.usage.testResetAlert,
    (): Promise<{ ok: boolean; error?: string }> => sendResetAlertTest(),
  );

  // --- Threshold alerts (OS notification, in-app toast fallback) ---
  ipcMain.handle(
    IPC.usage.setThresholdAlerts,
    async (_e, alerts: UsageThresholdAlertSettings): Promise<void> => {
      const settings = await store.getSettings();
      await store.setSettings({ ...settings, usageThresholdAlerts: alerts });
    },
  );

  ipcMain.handle(
    IPC.usage.testThresholdAlert,
    (): Promise<{ ok: boolean; error?: string }> => sendThresholdAlertTest(),
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
    (_e, providerId: string, size?: WidgetSize, mode?: WidgetMode): Promise<DesktopWidgetInstance> =>
      widgetManager.open(providerId, size, mode),
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
