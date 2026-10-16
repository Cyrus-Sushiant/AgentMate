import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { electronState } from '../test/main/electronMock';

/**
 * Regression tests for the update restart step. The release macOS builds are unsigned, so
 * Squirrel.Mac never accepted electron-updater's handoff: the dialog first offered a dead
 * "Restart now", then (after deferring it) sat at 100%. macOS now swaps its own bundle, so
 * restarting there must never go through `autoUpdater.quitAndInstall()`.
 */

vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    autoDownload: false,
    autoInstallOnAppQuit: true,
  },
}));

vi.mock('./ipc/send', () => ({ broadcastToWindows: vi.fn() }));
vi.mock('./ipc/terminal', () => ({ preserveTerminalsOnQuit: vi.fn() }));
vi.mock('./quitGuard', () => ({ allowQuit: vi.fn() }));
vi.mock('./updater/macInstall', () => ({
  launchMacInstall: vi.fn(),
  pickMacZip: vi.fn(),
  prepareMacUpdate: vi.fn(),
}));

const realPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform });
}

describe('quitAndInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronState.isPackaged = true;
    setPlatform('win32');
  });

  afterEach(() => {
    setPlatform(realPlatform);
  });

  it('keeps terminals, lifts the quit guard, then hands off to the installer', async () => {
    const updater = await import('./updater');
    const { autoUpdater } = await import('electron-updater');
    const { broadcastToWindows } = await import('./ipc/send');
    const { preserveTerminalsOnQuit } = await import('./ipc/terminal');
    const { allowQuit } = await import('./quitGuard');

    updater.quitAndInstall();

    expect(preserveTerminalsOnQuit).toHaveBeenCalledOnce();
    expect(allowQuit).toHaveBeenCalledOnce();
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce();
    expect(broadcastToWindows).not.toHaveBeenCalled();
  });

  it('broadcasts an error instead of leaving a dead dialog when the install throws', async () => {
    const updater = await import('./updater');
    const { autoUpdater } = await import('electron-updater');
    const { broadcastToWindows } = await import('./ipc/send');

    vi.mocked(autoUpdater.quitAndInstall).mockImplementationOnce(() => {
      throw new Error('No update filepath provided');
    });

    expect(() => updater.quitAndInstall()).toThrow('No update filepath provided');
    expect(broadcastToWindows).toHaveBeenCalledOnce();
    const status = vi.mocked(broadcastToWindows).mock.calls[0][1] as { state: string };
    expect(status.state).toBe('error');
  });

  it('does nothing in unpackaged runs', async () => {
    electronState.isPackaged = false;
    const updater = await import('./updater');
    const { autoUpdater } = await import('electron-updater');

    updater.quitAndInstall();

    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('on macOS, reports an error instead of handing off to Squirrel when nothing is staged', async () => {
    setPlatform('darwin');
    const updater = await import('./updater');
    const { autoUpdater } = await import('electron-updater');
    const { launchMacInstall } = await import('./updater/macInstall');
    const { broadcastToWindows } = await import('./ipc/send');

    expect(() => updater.quitAndInstall()).toThrow('No downloaded update to install.');
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    expect(launchMacInstall).not.toHaveBeenCalled();
    expect(electronState.quitCalls).toBe(0);
    const status = vi.mocked(broadcastToWindows).mock.calls[0][1] as { state: string };
    expect(status.state).toBe('error');
  });
});
