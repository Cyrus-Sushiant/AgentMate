import { beforeEach, describe, expect, it, vi } from 'vitest';
import { electronState } from '../test/main/electronMock';
import { shouldDeferDownloadedBroadcast } from './updater';

/**
 * Regression test for the macOS "Restart now does nothing" bug.
 *
 * On macOS electron-updater emits `update-downloaded` as soon as the zip is in
 * its cache, before Squirrel.Mac has fetched it from the local proxy server.
 * The app used to broadcast `downloaded` immediately, so the dialog offered
 * "Restart now" while MacUpdater.quitAndInstall() could only wait for the
 * native event: the click appeared dead and the dialog stayed open.
 * `shouldDeferDownloadedBroadcast` is the gate that keeps the dialog hidden
 * until the native handoff has resolved; these tests pin its truth table.
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

describe('shouldDeferDownloadedBroadcast', () => {
  it('defers the downloaded dialog on macOS while the native handoff is in flight', () => {
    expect(shouldDeferDownloadedBroadcast('darwin', true)).toBe(true);
  });

  it('shows the dialog on macOS once the handoff has resolved', () => {
    expect(shouldDeferDownloadedBroadcast('darwin', false)).toBe(false);
  });

  it('never defers on Windows, even with an active download', () => {
    expect(shouldDeferDownloadedBroadcast('win32', true)).toBe(false);
    expect(shouldDeferDownloadedBroadcast('win32', false)).toBe(false);
  });

  it('never defers on Linux, even with an active download', () => {
    expect(shouldDeferDownloadedBroadcast('linux', true)).toBe(false);
    expect(shouldDeferDownloadedBroadcast('linux', false)).toBe(false);
  });
});

describe('quitAndInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronState.isPackaged = true;
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
});
