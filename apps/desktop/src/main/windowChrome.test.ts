import { describe, expect, it } from 'vitest';
import { TITLE_BAR_HEIGHT } from '../shared/windowChrome';
import { withPlatform } from '../test/main/fixtures';
import { titleBarFrameOptions } from './windowChrome';

describe('titleBarFrameOptions', () => {
  it('keeps the native macOS frame so the real traffic lights are drawn', async () => {
    const options = await withPlatform('darwin', titleBarFrameOptions);

    expect(options.titleBarStyle).toBe('hidden');
    // A frameless window has no traffic lights at all, so `frame: false` must not sneak back in.
    expect(options.frame).toBeUndefined();
  });

  it('centers the traffic lights in the title bar', async () => {
    const options = await withPlatform('darwin', titleBarFrameOptions);
    const position = options.trafficLightPosition;
    if (!position) throw new Error('No traffic light position on macOS');

    // The button frames are 16px tall: the space above them matches the space below.
    expect(position.y * 2 + 16).toBe(TITLE_BAR_HEIGHT);
    expect(position.x).toBe(16);
  });

  it('goes frameless on Windows and Linux, where the page draws its own caption buttons', async () => {
    for (const platform of ['win32', 'linux'] as const) {
      const options = await withPlatform(platform, titleBarFrameOptions);
      expect(options).toEqual({ frame: false });
    }
  });
});
