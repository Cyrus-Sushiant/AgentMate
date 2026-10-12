import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRdpKeyboardLock } from './useRdpKeyboardLock';

const keyboard = { lock: vi.fn(), unlock: vi.fn() };
let fullscreenElement: Element | null = null;

function setFullscreen(element: Element | null): void {
  fullscreenElement = element;
  document.dispatchEvent(new Event('fullscreenchange'));
}

beforeEach(() => {
  fullscreenElement = null;
  keyboard.lock.mockReset().mockResolvedValue(undefined);
  keyboard.unlock.mockReset();
  Object.defineProperty(navigator, 'keyboard', { value: keyboard, configurable: true });
  Object.defineProperty(document, 'fullscreenElement', {
    get: () => fullscreenElement,
    configurable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'keyboard');
  Reflect.deleteProperty(document, 'fullscreenElement');
});

describe('useRdpKeyboardLock', () => {
  it('locks the keyboard once the connected page is in full screen', () => {
    renderHook(() => useRdpKeyboardLock(true));
    expect(keyboard.lock).not.toHaveBeenCalled();

    setFullscreen(document.documentElement);

    // No key list: the Windows key, Alt+Tab and the rest all go to the server.
    expect(keyboard.lock).toHaveBeenCalledOnce();
    expect(keyboard.lock).toHaveBeenCalledWith();
  });

  it('locks right away when the page is already in full screen at connect time', () => {
    fullscreenElement = document.documentElement;
    renderHook(() => useRdpKeyboardLock(true));
    expect(keyboard.lock).toHaveBeenCalledOnce();
  });

  it('releases the keyboard when full screen ends', () => {
    renderHook(() => useRdpKeyboardLock(true));
    setFullscreen(document.documentElement);
    keyboard.unlock.mockClear();

    setFullscreen(null);

    expect(keyboard.unlock).toHaveBeenCalledOnce();
  });

  it('does nothing before the session is connected, and lets go if it drops', () => {
    fullscreenElement = document.documentElement;
    const { rerender } = renderHook(({ connected }) => useRdpKeyboardLock(connected), {
      initialProps: { connected: false },
    });
    setFullscreen(document.documentElement);
    expect(keyboard.lock).not.toHaveBeenCalled();

    rerender({ connected: true });
    expect(keyboard.lock).toHaveBeenCalledOnce();

    keyboard.unlock.mockClear();
    rerender({ connected: false });
    expect(keyboard.unlock).toHaveBeenCalledOnce();

    // The listener went away with the connection.
    keyboard.lock.mockClear();
    setFullscreen(document.documentElement);
    expect(keyboard.lock).not.toHaveBeenCalled();
  });

  it('releases the keyboard and stops listening on unmount', () => {
    const { unmount } = renderHook(() => useRdpKeyboardLock(true));
    keyboard.unlock.mockClear();

    unmount();
    expect(keyboard.unlock).toHaveBeenCalledOnce();

    setFullscreen(document.documentElement);
    expect(keyboard.lock).not.toHaveBeenCalled();
  });

  it('carries on when the lock is refused', async () => {
    keyboard.lock.mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));
    renderHook(() => useRdpKeyboardLock(true));

    setFullscreen(document.documentElement);

    await expect(keyboard.lock.mock.results[0]?.value).rejects.toThrow('Not allowed');
  });

  it('is a no-op where the browser has no Keyboard Lock API', () => {
    Reflect.deleteProperty(navigator, 'keyboard');
    expect(() => {
      renderHook(() => useRdpKeyboardLock(true));
      setFullscreen(document.documentElement);
    }).not.toThrow();
  });
});
