import { describe, expect, it } from 'vitest';
import { type FrameMapping, frameSizeFor, toDesktop } from './rdpCoords';

describe('frameSizeFor', () => {
  it('scales a wide desktop down to the max width, keeping its aspect', () => {
    expect(frameSizeFor(1920, 1080)).toEqual({ width: 1280, height: 720, scale: 1280 / 1920 });
    expect(frameSizeFor(2560, 1440, 1024)).toEqual({ width: 1024, height: 576, scale: 0.4 });
  });

  it('never scales a small desktop up', () => {
    expect(frameSizeFor(1024, 768)).toEqual({ width: 1024, height: 768, scale: 1 });
    expect(frameSizeFor(1280, 1024)).toEqual({ width: 1280, height: 1024, scale: 1 });
  });

  it('always gives whole pixel sizes', () => {
    const size = frameSizeFor(1366, 768);
    expect(size.width).toBe(1280);
    expect(Number.isInteger(size.height)).toBe(true);
    expect(size.height).toBe(Math.round((768 * 1280) / 1366));
  });
});

describe('toDesktop', () => {
  const half: FrameMapping = {
    frameWidth: 960,
    frameHeight: 540,
    desktopWidth: 1920,
    desktopHeight: 1080,
  };

  it('scales a screenshot point to the desktop', () => {
    expect(toDesktop(half, 480, 270)).toEqual({ x: 960, y: 540, clamped: false });
    expect(toDesktop(half, 0, 0)).toEqual({ x: 0, y: 0, clamped: false });
  });

  it('rounds to a whole pixel', () => {
    const odd: FrameMapping = {
      frameWidth: 1280,
      frameHeight: 720,
      desktopWidth: 1920,
      desktopHeight: 1080,
    };
    expect(toDesktop(odd, 1, 1)).toEqual({ x: 2, y: 2, clamped: false });
  });

  it('keeps the last screenshot pixel on the desktop', () => {
    expect(toDesktop(half, 959, 539)).toEqual({ x: 1918, y: 1078, clamped: false });
  });

  it('pulls a point outside the screenshot back onto the desktop and says so', () => {
    expect(toDesktop(half, 2000, 270)).toEqual({ x: 1919, y: 540, clamped: true });
    expect(toDesktop(half, 480, 540)).toEqual({ x: 960, y: 1079, clamped: true });
    expect(toDesktop(half, -5, 10)).toEqual({ x: 0, y: 20, clamped: true });
  });

  it('passes points through when the screenshot is full size', () => {
    const same: FrameMapping = {
      frameWidth: 800,
      frameHeight: 600,
      desktopWidth: 800,
      desktopHeight: 600,
    };
    expect(toDesktop(same, 123, 456)).toEqual({ x: 123, y: 456, clamped: false });
  });
});
