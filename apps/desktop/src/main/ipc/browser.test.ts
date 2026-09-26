import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BrowserElementShot } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import {
  expectChannelsCovered,
  fakeWebContents,
  invokeFrom,
  loadIpc,
  useTempUserData,
} from '../../test/main/ipcHarness';
import { cropRect } from './browser';

/**
 * Screenshots of a picked page element. What matters for safety is which pages can be captured:
 * only a webview guest hosted by the window that asks. Everything else is the crop maths, which
 * has to cope with a zoomed page and a HiDPI screen.
 */

interface FakeImage {
  size: { width: number; height: number };
  cropped?: { x: number; y: number; width: number; height: number };
  resizedTo?: { width: number; height: number };
  bytes: number;
}

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

function image(
  width: number,
  height: number,
  bytes = PNG.length,
): FakeImage & Record<string, unknown> {
  const self: FakeImage & Record<string, unknown> = {
    size: { width, height },
    bytes,
    isEmpty: () => width === 0 || height === 0,
    getSize: () => ({ width, height }),
    toPNG: () => (bytes > PNG.length ? Buffer.alloc(bytes) : PNG),
    toDataURL: () => `data:image/png;base64,thumb-${width}x${height}`,
    crop: (rect: { x: number; y: number; width: number; height: number }) => {
      const next = image(rect.width, rect.height, bytes);
      next.cropped = rect;
      return next;
    },
    resize: (size: { width: number; height: number }) => {
      const next = image(size.width, size.height, Math.round(bytes / 4));
      next.resizedTo = size;
      return next;
    },
  };
  return self;
}

const userData = useTempUserData();
const host = fakeWebContents();
let guests: Map<number, Record<string, unknown>>;
let lastCrop: FakeImage | null;

expectChannelsCovered(IPC.browser, [IPC.browser.onGuestShortcut, IPC.browser.onOpenInNewTab]);

function guest(id: number, overrides: Record<string, unknown> = {}): void {
  const screen = image(2560, 1600);
  const originalCrop = screen.crop as (
    rect: FakeImage['size'] & { x: number; y: number },
  ) => FakeImage;
  screen.crop = (rect: { x: number; y: number; width: number; height: number }) => {
    lastCrop = originalCrop(rect);
    return lastCrop;
  };
  guests.set(id, {
    id,
    isDestroyed: () => false,
    getType: () => 'webview',
    hostWebContents: host,
    capturePage: async (_rect?: unknown, options?: unknown) => {
      captureOptions = options;
      return screen;
    },
    ...overrides,
  });
}

let captureOptions: unknown;

beforeEach(async () => {
  guests = new Map();
  lastCrop = null;
  captureOptions = undefined;
  await loadIpc(
    () => import('./browser'),
    (module) => module.registerBrowserHandlers(),
  );
  const electron = (await import('electron')) as unknown as {
    webContents: { fromId: (id: number) => unknown };
  };
  electron.webContents.fromId = (id: number) => guests.get(id) ?? null;
});

const rect = { x: 100, y: 50, width: 200, height: 40 };
const viewport = { width: 1280, height: 800 };

describe('browser:captureElement', () => {
  it('saves a crop of the element under the app data folder, with a thumbnail', async () => {
    guest(7);
    const shot = await invokeFrom<BrowserElementShot>(
      host,
      IPC.browser.captureElement,
      7,
      rect,
      viewport,
    );
    expect(shot).not.toBeNull();
    expect(shot?.path.startsWith(join(userData.dir, 'pasted-images'))).toBe(true);
    expect(shot?.path).toMatch(/element-[\d-T]+-[0-9a-f]{6}\.png$/);
    expect(readFileSync(shot?.path as string)).toEqual(PNG);
    expect(shot?.thumbDataUrl.startsWith('data:image/png')).toBe(true);
    // The page is 1280 CSS px wide on a 2560 px capture, so everything doubles, with 8 CSS px of
    // context around the element.
    expect(lastCrop?.cropped).toEqual({ x: 184, y: 84, width: 432, height: 112 });
  });

  it('captures the page as it is on screen, not as a hidden page', async () => {
    guest(7);
    await invokeFrom(host, IPC.browser.captureElement, 7, rect, viewport);
    expect(captureOptions).toEqual({ stayHidden: true });
  });

  it('refuses a page that is not a webview guest', async () => {
    guest(7, { getType: () => 'window' });
    await expect(invokeFrom(host, IPC.browser.captureElement, 7, rect, viewport)).rejects.toThrow(
      'That browser tab is gone.',
    );
  });

  it('refuses a guest hosted by another window', async () => {
    guest(7, { hostWebContents: fakeWebContents() });
    await expect(invokeFrom(host, IPC.browser.captureElement, 7, rect, viewport)).rejects.toThrow(
      'That browser tab is gone.',
    );
  });

  it('refuses an id that is gone or not a number', async () => {
    guest(7, { isDestroyed: () => true });
    await expect(invokeFrom(host, IPC.browser.captureElement, 7, rect, viewport)).rejects.toThrow(
      'That browser tab is gone.',
    );
    await expect(invokeFrom(host, IPC.browser.captureElement, '7', rect, viewport)).rejects.toThrow(
      'That browser tab is gone.',
    );
  });

  it('returns null for an element that is off screen', async () => {
    guest(7);
    const shot = await invokeFrom(
      host,
      IPC.browser.captureElement,
      7,
      { x: 5000, y: 5000, width: 10, height: 10 },
      viewport,
    );
    expect(shot).toBeNull();
  });

  it('refuses a rect that is not a rect', async () => {
    guest(7);
    await expect(
      invokeFrom(host, IPC.browser.captureElement, 7, { x: 'a' }, viewport),
    ).rejects.toThrow('Nothing to capture.');
  });

  it('scales a huge crop down until it fits the size limit', async () => {
    const big = image(2560, 1600, 9 * 1024 * 1024);
    guests.set(7, {
      id: 7,
      isDestroyed: () => false,
      getType: () => 'webview',
      hostWebContents: host,
      capturePage: async () => big,
    });
    const shot = await invokeFrom<BrowserElementShot>(
      host,
      IPC.browser.captureElement,
      7,
      { x: 0, y: 0, width: 1280, height: 800 },
      viewport,
    );
    expect(shot).not.toBeNull();
    expect(readFileSync(shot?.path as string).length).toBeLessThanOrEqual(2 * 1024 * 1024);
  });
});

describe('cropRect', () => {
  it('maps css pixels to bitmap pixels and pads the element', () => {
    expect(cropRect(rect, { width: 1280, height: 800 }, viewport)).toEqual({
      x: 92,
      y: 42,
      width: 216,
      height: 56,
    });
  });

  it('clamps to the captured area', () => {
    expect(
      cropRect({ x: -20, y: 780, width: 100, height: 100 }, { width: 1280, height: 800 }, viewport),
    ).toEqual({ x: 0, y: 772, width: 88, height: 28 });
  });

  it('is null when nothing of the element is on screen or the page has no size', () => {
    expect(
      cropRect({ x: 2000, y: 0, width: 10, height: 10 }, { width: 1280, height: 800 }, viewport),
    ).toBeNull();
    expect(cropRect(rect, { width: 1280, height: 800 }, { width: 0, height: 0 })).toBeNull();
  });
});
