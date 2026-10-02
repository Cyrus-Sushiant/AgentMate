import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureFrame } from './agentFrame';

interface Drawn {
  canvas: HTMLCanvasElement;
  args: unknown[];
}

/** Gives every canvas a fake 2D context and PNG export, since jsdom has neither. */
function stubCanvas(): { drawn: Drawn[] } {
  const drawn: Drawn[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    const canvas = this;
    return {
      drawImage: (...args: unknown[]) => drawn.push({ canvas, args }),
    } as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (
    this: HTMLCanvasElement,
    type?: string,
  ) {
    return `data:${type};base64,PNG${this.width}x${this.height}`;
  });
  return { drawn };
}

function source(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('captureFrame', () => {
  it('scales a wide desktop down to the max width, keeping its shape', () => {
    const { drawn } = stubCanvas();
    const canvas = source(1920, 1080);
    const frame = captureFrame(canvas, { width: 1920, height: 1080 });

    expect(frame).toEqual({
      png: 'PNG1280x720',
      width: 1280,
      height: 720,
      desktopWidth: 1920,
      desktopHeight: 1080,
    });
    expect(drawn).toHaveLength(1);
    expect(drawn[0].canvas).not.toBe(canvas);
    expect(drawn[0].args).toEqual([canvas, 0, 0, 1920, 1080, 0, 0, 1280, 720]);
  });

  it('never scales a small desktop up', () => {
    stubCanvas();
    const frame = captureFrame(source(1024, 768), { width: 1024, height: 768 });
    expect(frame).toMatchObject({ width: 1024, height: 768, png: 'PNG1024x768' });
  });

  it('rounds to whole pixels and honours a custom max width', () => {
    stubCanvas();
    const frame = captureFrame(source(1366, 768), { width: 1366, height: 768 }, 1000);
    // 768 * 1000 / 1366 = 562.2
    expect(frame).toMatchObject({ width: 1000, height: 562 });
  });

  it('refuses a canvas with nothing on it yet', () => {
    stubCanvas();
    expect(() => captureFrame(source(0, 0), { width: 1920, height: 1080 })).toThrow(
      /hasn't drawn the remote screen yet/,
    );
  });

  it('says so when the browser gives no 2D context', () => {
    // The renderer test setup makes getContext return null.
    expect(() => captureFrame(source(800, 600), { width: 800, height: 600 })).toThrow(
      /Couldn't take a screenshot/,
    );
  });
});
