import { describe, expect, it } from 'vitest';
import { imageMimeType, isImagePath, isTextImagePath } from './imageFiles';

describe('imageMimeType', () => {
  it('maps the formats the viewer can paint', () => {
    expect(imageMimeType('logo.png')).toBe('image/png');
    expect(imageMimeType('photo.JPG')).toBe('image/jpeg');
    expect(imageMimeType('icon.svg')).toBe('image/svg+xml');
    expect(imageMimeType('sprite.webp')).toBe('image/webp');
  });

  it('reads the extension off a full path on either separator', () => {
    expect(imageMimeType('E:\\proj\\assets\\shot.png')).toBe('image/png');
    expect(imageMimeType('/home/me/proj/assets/shot.gif')).toBe('image/gif');
  });

  it('leaves everything else alone', () => {
    expect(imageMimeType('index.ts')).toBeNull();
    expect(imageMimeType('scan.tiff')).toBeNull();
    expect(imageMimeType('README')).toBeNull();
    // A dotfile is not an extension.
    expect(imageMimeType('.png')).toBeNull();
    // The folder above the file does not decide the type.
    expect(imageMimeType('png/notes.txt')).toBeNull();
  });
});

describe('isImagePath', () => {
  it('answers for a path with no extension', () => {
    expect(isImagePath('Makefile')).toBe(false);
    expect(isImagePath('shot.bmp')).toBe(true);
  });
});

describe('isTextImagePath', () => {
  it('only an SVG has source worth editing', () => {
    expect(isTextImagePath('icon.SVG')).toBe(true);
    expect(isTextImagePath('icon.png')).toBe(false);
  });
});
