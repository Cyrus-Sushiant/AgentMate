import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  describeSystemImage,
  parseSdkManagerList,
  parseSystemImageId,
  sortSystemImages,
} from './sdkManager.js';

/**
 * The newer command-line tools deprecate `sdkmanager` and hand off to the Android CLI, which
 * prints a completely different table: ANSI colours, whitespace-separated columns instead of
 * pipes, and package paths with slashes instead of semicolons. Both formats are in the wild, so
 * both have to be read, and the slash form has to come back as the semicolon id that
 * `avdmanager -k` actually takes.
 */

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf-8');

describe('parseSdkManagerList on the Android CLI format', () => {
  const { installed, available } = parseSdkManagerList(fixture('sdkmanager-android-cli.txt'));

  it('finds the installed system images through the colour codes', () => {
    expect(installed.map((image) => image.id)).toEqual([
      'system-images;android-37.0;google_apis_playstore_ps16k;x86_64',
      'system-images;android-34;google_apis;x86_64',
    ]);
  });

  it('hands back the semicolon id avdmanager takes, not the slash path it printed', () => {
    for (const image of [...installed, ...available]) {
      expect(image.id).not.toContain('/');
      expect(image.id.startsWith('system-images;')).toBe(true);
    }
  });

  it('reads the API level even when it is written as a decimal', () => {
    expect(installed[0].api).toBe(37);
    expect(installed[0].tag).toBe('google_apis_playstore_ps16k');
    expect(installed[0].abi).toBe('x86_64');
    expect(installed[0].playStore).toBe(true);
  });

  it('separates the available section from the installed one', () => {
    expect(available.map((image) => image.id)).toEqual([
      'system-images;android-36;google_apis;arm64-v8a',
      'system-images;android-canary-20260909;google_apis_ps16k;x86_64',
    ]);
  });

  it('keeps out everything that is not a system image', () => {
    const all = [...installed, ...available].map((image) => image.id);
    expect(all.some((id) => id.includes('build-tools'))).toBe(false);
    expect(all.some((id) => id.includes('platform-tools'))).toBe(false);
  });

  it('ignores the deprecation banner above the table', () => {
    expect([...installed, ...available].some((image) => image.id.includes('WARNING'))).toBe(false);
  });

  it('reads the version past the -> an upgradable row carries', () => {
    // "4.0.0  ->  7.0.0  <description>" must not read the arrow as the version.
    expect(installed[0].version).toBe('4.0.0');
    expect(installed[0].description).toContain('System Image');
  });
});

describe('parseSystemImageId with the newer API spellings', () => {
  it('reads a decimal API level', () => {
    expect(parseSystemImageId('system-images;android-37.0;google_apis;x86_64')).toMatchObject({
      api: 37,
    });
  });

  it('has no number for a preview channel, and says so rather than guessing', () => {
    expect(
      parseSystemImageId('system-images;android-canary-20260909;google_apis_ps16k;x86_64'),
    ).toMatchObject({ api: null, tag: 'google_apis_ps16k', abi: 'x86_64' });
  });

  it('still reads the plain form', () => {
    expect(parseSystemImageId('system-images;android-34;google_apis;x86_64')).toMatchObject({
      api: 34,
    });
  });
});

describe('parseSdkManagerList still reads the classic pipe format', () => {
  it('has not been broken by supporting the new one', () => {
    const { installed } = parseSdkManagerList(fixture('sdkmanager-list.txt'));
    expect(installed.map((image) => image.id)).toEqual([
      'system-images;android-34;google_apis;x86_64',
      'system-images;android-33;google_apis_playstore;arm64-v8a',
    ]);
  });
});

describe('ordering and labelling a real-sized list', () => {
  const image = (id: string) => {
    const parsed = parseSystemImageId(id);
    if (!parsed) throw new Error(`not an image id: ${id}`);
    return { id, ...parsed, version: '1', description: '' };
  };

  it('puts the newest stable release first and previews last', () => {
    const list = [
      image('system-images;android-canary-20260909;google_apis;x86_64'),
      image('system-images;android-34;google_apis;x86_64'),
      image('system-images;android-36;google_apis;x86_64'),
    ];

    // A preview has no API number. Sorting those to the top buried every usable release under
    // hundreds of canary builds.
    expect(sortSystemImages(list).map((one) => one.api)).toEqual([36, 34, null]);
  });

  it('tells two previews apart instead of calling them both Preview', () => {
    const canary = describeSystemImage(
      image('system-images;android-canary-20260909;google_apis;x86_64'),
    );
    const other = describeSystemImage(
      image('system-images;android-canary-20260101;google_apis;x86_64'),
    );

    expect(canary).not.toBe(other);
    expect(canary).toContain('20260909');
  });

  it('still reads plainly for a stable release', () => {
    expect(describeSystemImage(image('system-images;android-34;google_apis;x86_64'))).toBe(
      'Android 14 (API 34) · Google APIs · x86_64',
    );
  });
});

describe('every image in the list reads differently from every other', () => {
  const image = (id: string) => {
    const parsed = parseSystemImageId(id);
    if (!parsed) throw new Error(`not an image id: ${id}`);
    return { id, ...parsed, version: '1', description: '' };
  };

  it('keeps the minor version, since 37.0 and 37.1 are different images', () => {
    const a = describeSystemImage(image('system-images;android-37.0;google_apis;x86_64'));
    const b = describeSystemImage(image('system-images;android-37.1;google_apis;x86_64'));

    expect(a).not.toBe(b);
    expect(a).toContain('37.0');
  });

  it('tells the tag variants apart rather than calling them all Google Play', () => {
    const plain = describeSystemImage(
      image('system-images;android-36;google_apis_playstore;x86_64'),
    );
    const pages = describeSystemImage(
      image('system-images;android-36;google_apis_playstore_ps16k;x86_64'),
    );
    const tablet = describeSystemImage(
      image('system-images;android-36;google_apis_playstore_tablet;x86_64'),
    );

    expect(new Set([plain, pages, tablet]).size).toBe(3);
  });

  it('gives every tag the real list uses a label of its own', () => {
    // Taken from an actual `sdkmanager --list` on a current SDK. Two rows that read the same are
    // two rows nobody can choose between.
    const tags = [
      'default',
      'google_apis',
      'android-tv',
      'google_apis_playstore',
      'android-wear',
      'android-wear-cn',
      'aosp_atd',
      'google-tv',
      'google_atd',
      'android-desktop',
      'android-automotive-distant-display-playstore',
      'android-automotive',
      'android-automotive-playstore',
      'android-xr-preview-playstore',
      'google-xr',
      'google_apis_playstore_ps16k',
      'google_apis_playstore_tablet',
      'google_apis_ps16k',
      'google_apis_tablet',
      'android-wear-signed',
      'google-tv-ps16k',
    ];

    const labels = tags.map((tag) =>
      describeSystemImage(image(`system-images;android-36;${tag};x86_64`)),
    );

    expect(new Set(labels).size).toBe(tags.length);
  });

  it('still reads plainly for the common case', () => {
    expect(describeSystemImage(image('system-images;android-34;google_apis;x86_64'))).toBe(
      'Android 14 (API 34) · Google APIs · x86_64',
    );
  });
});
