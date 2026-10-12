import { useEffect } from 'react';

/** The part of the Keyboard Lock API this uses. TypeScript's DOM library doesn't ship it. */
interface KeyboardLock {
  lock(keyCodes?: string[]): Promise<void>;
  unlock(): void;
}

/**
 * While the session is connected and the page is in full screen, sends the Windows key and the
 * shortcuts built on it (Win+V, Win+D, Alt+Tab, ...) to the remote screen instead of this
 * computer's shell, the way Remote Desktop Connection does in full screen. Chromium only grants
 * the lock while the page is in HTML full screen, which the main process enters along with the
 * window's own (main/rdp/sessionWindows.ts), so this follows `fullscreenchange`.
 *
 * Holding Escape for two seconds releases the lock, as in any page that locks the keyboard.
 */
export function useRdpKeyboardLock(connected: boolean): void {
  useEffect(() => {
    const keyboard = (navigator as unknown as { keyboard?: KeyboardLock }).keyboard;
    if (!connected || !keyboard) return;

    const sync = (): void => {
      if (document.fullscreenElement) {
        // Refused when the page isn't allowed to lock, and then the shortcuts simply stay local.
        keyboard.lock().catch(() => undefined);
      } else {
        keyboard.unlock();
      }
    };
    document.addEventListener('fullscreenchange', sync);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      keyboard.unlock();
    };
  }, [connected]);
}
