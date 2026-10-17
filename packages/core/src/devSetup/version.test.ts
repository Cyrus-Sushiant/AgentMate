import { describe, expect, it } from 'vitest';
import { compareVersions, meetsMinimum, parseVersion } from './version.js';

describe('parseVersion', () => {
  it.each([
    ['v22.12.0', '22.12.0'],
    ['10.9.0', '10.9.0'],
    ['git version 2.55.0.windows.5', '2.55.0'],
    ['git version 2.39.5 (Apple Git-154)', '2.39.5'],
    ['javac 17.0.12', '17.0.12'],
    ['Docker version 28.4.0, build abc1234', '28.4.0'],
    ['Dart SDK version: 3.13.5 (stable) (Tue Oct 7 2025) on "windows_x64"', '3.13.5'],
    ['WSL version: 2.5.9.0', '2.5.9'],
    ['gh version 2.62.0 (2025-01-08)\nhttps://github.com/cli/cli/releases/tag/v2.62.0', '2.62.0'],
    ['10.0.104', '10.0.104'],
  ])('reads %j as %s', (text, expected) => {
    expect(parseVersion(text)).toBe(expected);
  });

  it('returns null when there is nothing version shaped', () => {
    expect(parseVersion('')).toBeNull();
    expect(parseVersion('command not found')).toBeNull();
    expect(parseVersion('openjdk 17 2021-09-14')).toBeNull();
  });

  it('ignores a date that happens to sit before the version', () => {
    expect(parseVersion('2025-01-08 release 4.5.6')).toBe('4.5.6');
  });

  it('can accept a bare major number for tools that print one, such as a JDK GA build', () => {
    expect(parseVersion('javac 21', { majorOnly: true })).toBe('21');
    expect(parseVersion('javac 21.0.2', { majorOnly: true })).toBe('21.0.2');
    expect(parseVersion('no digits', { majorOnly: true })).toBeNull();
  });
});

describe('compareVersions', () => {
  it('compares each part as a number, not as text', () => {
    expect(compareVersions('10.0.0', '9.9.9')).toBeGreaterThan(0);
    expect(compareVersions('22.12.0', '22.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.2.3', '1.2.4')).toBeLessThan(0);
  });

  it('treats a missing part as zero', () => {
    expect(compareVersions('2.30', '2.30.0')).toBe(0);
    expect(compareVersions('17', '17.0.0')).toBe(0);
    expect(compareVersions('17.0.1', '17')).toBeGreaterThan(0);
  });

  it('ignores a leading v and any prerelease suffix', () => {
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3-rc.1', '1.2.3')).toBe(0);
  });
});

describe('meetsMinimum', () => {
  it('is true at and above the minimum', () => {
    expect(meetsMinimum('22.12.0', '22.12.0')).toBe(true);
    expect(meetsMinimum('23.0.0', '22.12.0')).toBe(true);
  });

  it('is false below the minimum', () => {
    expect(meetsMinimum('20.1.0', '22.12.0')).toBe(false);
    expect(meetsMinimum('22.11.9', '22.12.0')).toBe(false);
  });

  it('is false when the version could not be read', () => {
    expect(meetsMinimum(null, '1.0.0')).toBe(false);
  });

  it('is true for any readable version when there is no minimum', () => {
    expect(meetsMinimum('0.0.1', undefined)).toBe(true);
    expect(meetsMinimum(null, undefined)).toBe(true);
  });
});
