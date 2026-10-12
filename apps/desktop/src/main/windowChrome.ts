import type { BrowserWindowConstructorOptions } from 'electron';
import { MAC_TRAFFIC_LIGHT_POSITION } from '../shared/windowChrome';

type FrameOptions = Pick<
  BrowserWindowConstructorOptions,
  'frame' | 'titleBarStyle' | 'trafficLightPosition'
>;

/**
 * Frame options for a window that draws its own title bar.
 *
 * On macOS the native frame stays and only its title bar is hidden, so the OS keeps drawing the
 * real traffic lights (with their hover glyphs, grey inactive state, fullscreen hiding and
 * double-click behavior) on top of our bar. Windows and Linux get a frameless window and the
 * page draws its own caption buttons.
 */
export function titleBarFrameOptions(): FrameOptions {
  if (process.platform === 'darwin') {
    return { titleBarStyle: 'hidden', trafficLightPosition: { ...MAC_TRAFFIC_LIGHT_POSITION } };
  }
  return { frame: false };
}
