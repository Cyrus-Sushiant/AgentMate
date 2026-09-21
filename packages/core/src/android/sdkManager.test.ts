import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  describeSystemImage,
  parseSdkManagerList,
  parseSystemImageId,
  sortSystemImages,
} from './sdkManager.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf-8');

describe('parseSdkManagerList', () => {
  const { installed, available } = parseSdkManagerList(fixture('sdkmanager-list.txt'));

  it('splits the installed and available sections', () => {
    expect(installed.map((i) => i.id)).toEqual([
      'system-images;android-34;google_apis;x86_64',
      'system-images;android-33;google_apis_playstore;arm64-v8a',
    ]);
    expect(available.map((i) => i.id)).toEqual(['system-images;android-35;google_apis;x86_64']);
  });

  it('keeps only system images, not build-tools or platform-tools', () => {
    for (const image of [...installed, ...available]) {
      expect(image.id.startsWith('system-images;')).toBe(true);
    }
  });

  it('skips the column rule rows', () => {
    for (const image of installed) expect(image.id).not.toContain('---');
  });

  it('returns empty lists for output with no packages', () => {
    expect(parseSdkManagerList('')).toEqual({ installed: [], available: [] });
  });
});

describe('parseSystemImageId', () => {
  it('breaks an image id into its parts', () => {
    expect(parseSystemImageId('system-images;android-34;google_apis;x86_64')).toEqual({
      api: 34,
      tag: 'google_apis',
      abi: 'x86_64',
      playStore: false,
    });
    expect(parseSystemImageId('system-images;android-33;google_apis_playstore;arm64-v8a')).toEqual({
      api: 33,
      tag: 'google_apis_playstore',
      abi: 'arm64-v8a',
      playStore: true,
    });
  });

  it('handles preview API levels and refuses anything else', () => {
    expect(
      parseSystemImageId('system-images;android-TiramisuPrivacySandbox;google_apis;x86_64'),
    ).toMatchObject({ api: null, tag: 'google_apis' });
    expect(parseSystemImageId('platform-tools')).toBeNull();
  });
});

describe('describeSystemImage', () => {
  it('reads as a sentence a person would recognise', () => {
    const image = {
      id: 'system-images;android-34;google_apis;x86_64',
      api: 34,
      tag: 'google_apis',
      abi: 'x86_64',
      playStore: false,
      version: '12',
      description: 'Google APIs Intel x86_64 Atom System Image',
    };
    expect(describeSystemImage(image)).toBe('Android 14 (API 34) · Google APIs · x86_64');
  });

  it('names Play Store images as such', () => {
    expect(
      describeSystemImage({
        id: 'system-images;android-33;google_apis_playstore;arm64-v8a',
        api: 33,
        tag: 'google_apis_playstore',
        abi: 'arm64-v8a',
        playStore: true,
        version: '10',
        description: '',
      }),
    ).toBe('Android 13 (API 33) · Google Play · arm64-v8a');
  });
});

describe('sortSystemImages', () => {
  it('puts the newest API first', () => {
    const { installed } = parseSdkManagerList(fixture('sdkmanager-list.txt'));
    expect(sortSystemImages(installed).map((i) => i.api)).toEqual([34, 33]);
  });
});
