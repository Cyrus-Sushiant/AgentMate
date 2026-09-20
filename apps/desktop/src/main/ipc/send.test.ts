import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeWindow = {
  isDestroyed: () => boolean;
  webContents: { isDestroyed: () => boolean; send: (channel: string, ...args: unknown[]) => void };
};

const windows: FakeWindow[] = [];

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => windows },
}));

const { broadcastToWindows, sendToContents, sendToWindow } = await import('./send');

function fakeWindow(options: { destroyed?: boolean; throws?: boolean } = {}): FakeWindow {
  return {
    isDestroyed: () => options.destroyed === true,
    webContents: {
      isDestroyed: () => options.destroyed === true,
      send: vi.fn(() => {
        if (options.throws) throw new Error('Render frame was disposed');
      }),
    },
  };
}

describe('main IPC send helpers', () => {
  beforeEach(() => {
    windows.length = 0;
  });

  it('sends to a live window', () => {
    const win = fakeWindow();
    sendToWindow(win as never, 'channel', 1, 2);
    expect(win.webContents.send).toHaveBeenCalledWith('channel', 1, 2);
  });

  it('skips a destroyed window and a missing one', () => {
    const win = fakeWindow({ destroyed: true });
    sendToWindow(win as never, 'channel');
    sendToWindow(null, 'channel');
    sendToContents(undefined, 'channel');
    expect(win.webContents.send).not.toHaveBeenCalled();
  });

  it('swallows the disposed-frame race', () => {
    const win = fakeWindow({ throws: true });
    expect(() => sendToWindow(win as never, 'channel')).not.toThrow();
  });

  it('broadcasts to every window, and one bad frame does not stop the rest', () => {
    const bad = fakeWindow({ throws: true });
    const good = fakeWindow();
    windows.push(bad, good);
    broadcastToWindows('channel', 'payload');
    expect(good.webContents.send).toHaveBeenCalledWith('channel', 'payload');
  });
});
