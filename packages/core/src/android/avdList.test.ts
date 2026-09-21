import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAvdManagerList, parseEmulatorListAvds } from './avdList.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf-8');

describe('parseEmulatorListAvds', () => {
  it('reads one id per line', () => {
    expect(parseEmulatorListAvds(fixture('emulator-list-avds.txt'))).toEqual([
      'Pixel_7_API_34',
      'Pixel_Tablet_API_33',
      // Studio can create an AVD whose id has a space in it, so the reader must not split on one.
      'My Tablet',
    ]);
  });

  it('ignores the warnings the emulator prints before the list', () => {
    const noisy = 'INFO    | Storing crashdata in: /tmp/x\nPixel_7_API_34\n';
    expect(parseEmulatorListAvds(noisy)).toEqual(['Pixel_7_API_34']);
    expect(parseEmulatorListAvds('')).toEqual([]);
  });
});

describe('parseAvdManagerList', () => {
  const { avds, broken } = parseAvdManagerList(fixture('avdmanager-list-avd.txt'));

  it('reads every loadable AVD', () => {
    expect(avds).toHaveLength(2);
    expect(avds.map((a) => a.name)).toEqual(['Pixel_7_API_34', 'Pixel_Tablet_API_33']);
  });

  it('splits the tag and abi out of the Based on continuation line', () => {
    expect(avds[0]).toMatchObject({
      device: 'pixel_7',
      target: 'Google APIs',
      androidVersion: '14.0',
      tag: 'google_apis',
      abi: 'x86_64',
      playStore: false,
    });
    expect(avds[1]).toMatchObject({ tag: 'google_apis_playstore', playStore: true });
  });

  it('keeps both Windows and POSIX paths intact', () => {
    expect(avds[0].path).toBe('C:\\Users\\dev\\.android\\avd\\Pixel_7_API_34.avd');
    expect(avds[1].path).toBe('/home/dev/.android/avd/Pixel_Tablet_API_33.avd');
  });

  it('collects the AVDs that could not be loaded with their reason', () => {
    expect(broken).toEqual([
      {
        name: 'Broken_One',
        path: '/home/dev/.android/avd/Broken_One.avd',
        error: 'Missing system image for Google APIs arm64-v8a Broken_One.',
      },
    ]);
  });

  it('does not leak the separator row into a field', () => {
    for (const avd of avds) expect(avd.name).not.toContain('-----');
  });

  it('handles an empty list', () => {
    expect(parseAvdManagerList('Available Android Virtual Devices:\n')).toEqual({
      avds: [],
      broken: [],
    });
  });
});
