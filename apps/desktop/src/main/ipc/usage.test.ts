import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import { invoke, loadIpc, useTempUserData } from '../../test/main/ipcHarness';

/**
 * The Token Usage channels the renderer calls. Refreshing one provider has to re-read that provider
 * with the settings saved for it, and a request for a provider the app does not know must be
 * refused rather than sent on to a scanner.
 */

const usage = vi.hoisted(() => ({
  refreshProviderUsage: vi.fn(),
  getAllUsage: vi.fn(),
  getProviderUsage: vi.fn(),
  clearUsageCache: vi.fn(),
}));
vi.mock('../usage', () => usage);
vi.mock('../usage/resetAlerts', () => ({
  refreshResetAlerts: vi.fn(),
  sendResetAlertTest: vi.fn(),
}));
vi.mock('../usage/thresholdAlerts', () => ({ sendThresholdAlertTest: vi.fn() }));
vi.mock('../usage/widgetWindows', () => ({ widgetManager: {} }));

const userData = useTempUserData();

async function register(): Promise<void> {
  await loadIpc(
    () => import('./usage'),
    (module) => module.registerUsageHandlers(),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  userData.writeData('settings.json', {
    usageProviderConfigs: { openai: { enabled: true, apiKey: 'sk-test' } },
  });
  usage.refreshProviderUsage.mockResolvedValue({ providerId: 'openai', status: 'ok' });
  await register();
});

describe('usage:refreshProvider', () => {
  it('re-reads the provider with the settings saved for it and hands back the snapshot', async () => {
    const result = await invoke(IPC.usage.refreshProvider, 'openai');

    expect(usage.refreshProviderUsage).toHaveBeenCalledWith('openai', {
      enabled: true,
      apiKey: 'sk-test',
    });
    expect(result).toEqual({ providerId: 'openai', status: 'ok' });
  });

  it('refuses a provider the app does not know, without re-reading anything', async () => {
    await expect(invoke(IPC.usage.refreshProvider, 'not-a-provider')).rejects.toThrow(
      'Unknown usage provider: not-a-provider',
    );
    expect(usage.refreshProviderUsage).not.toHaveBeenCalled();
  });

  it('refuses a request that is not a provider id at all', async () => {
    await expect(invoke(IPC.usage.refreshProvider, 42)).rejects.toThrow(
      'Unknown usage provider: 42',
    );
    expect(usage.refreshProviderUsage).not.toHaveBeenCalled();
  });
});
