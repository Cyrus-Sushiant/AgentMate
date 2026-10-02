import { describe, expect, it, vi } from 'vitest';
import { FakeBrowserWindow } from '../../test/main/electronMock';
import { getRdpWindow, openRdpWindow, setRdpWindowBackgroundThrottling } from './sessionWindows';

describe('Remote Desktop session windows', () => {
  it('finds the window of an open session, and forgets it once closed', () => {
    const onClosed = vi.fn();
    const window = openRdpWindow({
      sessionId: 'rdp-1',
      title: 'Server - Remote Desktop',
      fullScreen: false,
      onClosed,
    });
    expect(getRdpWindow('rdp-1')).toBe(window);
    expect(getRdpWindow('rdp-2')).toBeNull();

    window.close();
    expect(onClosed).toHaveBeenCalled();
    expect(getRdpWindow('rdp-1')).toBeNull();
  });

  it('turns background throttling off and on for a session window', () => {
    const window = openRdpWindow({
      sessionId: 'rdp-3',
      title: 'Server - Remote Desktop',
      fullScreen: false,
      onClosed: () => undefined,
    }) as unknown as FakeBrowserWindow;
    const setBackgroundThrottling = vi.fn();
    Object.assign(window.webContents, { setBackgroundThrottling });

    setRdpWindowBackgroundThrottling('rdp-3', false);
    setRdpWindowBackgroundThrottling('rdp-3', true);
    expect(setBackgroundThrottling.mock.calls).toEqual([[false], [true]]);

    // A session without a window is left alone.
    expect(() => setRdpWindowBackgroundThrottling('missing', false)).not.toThrow();
    window.close();
  });
});
