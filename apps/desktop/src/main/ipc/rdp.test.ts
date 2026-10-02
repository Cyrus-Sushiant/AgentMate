import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import { FakeBrowserWindow } from '../../test/main/electronMock';
import { invoke, loadIpc, useTempUserData } from '../../test/main/ipcHarness';

/** Closing a Remote Desktop window ends whatever AI task was driving it. */

const fakes = vi.hoisted(() => ({
  stopRdpTask: vi.fn(),
  onClosed: [] as (() => void)[],
}));

vi.mock('../agents/rdpTaskRunner', () => ({ stopRdpTask: fakes.stopRdpTask }));
vi.mock('../rdp/sessionWindows', async () => {
  const { FakeBrowserWindow: Window } = await import('../../test/main/electronMock');
  return {
    openRdpWindow: (options: { onClosed: () => void }) => {
      fakes.onClosed.push(options.onClosed);
      return new Window();
    },
    closeAllRdpWindows: () => undefined,
  };
});

const userData = useTempUserData({ home: false });

beforeEach(async () => {
  fakes.stopRdpTask.mockClear();
  fakes.onClosed.length = 0;
  userData.writeData('rdp-servers.json', [
    {
      id: 'server-1',
      nickname: 'Build box',
      host: '10.0.0.5',
      port: 3389,
      username: 'admin',
      options: { resolution: 'fitWindow' },
      createdAt: 0,
      lastConnectedAt: null,
    },
  ]);
  await loadIpc(
    () => import('./rdp'),
    (module) => module.registerRdpHandlers(),
  );
});

describe('a Remote Desktop session window', () => {
  it('stops its AI task when it closes', async () => {
    const sessionId = await invoke<string>(IPC.rdp.openSession, 'server-1');
    expect(FakeBrowserWindow.instances).toHaveLength(1);
    expect(fakes.stopRdpTask).not.toHaveBeenCalled();

    fakes.onClosed[0]?.();
    expect(fakes.stopRdpTask).toHaveBeenCalledWith(sessionId, 'exited');
  });
});
