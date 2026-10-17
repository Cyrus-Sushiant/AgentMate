import { describe, expect, it } from 'vitest';
import { defaultSdkInstallRoot, licensesAccepted, parsePackageRevision } from './androidSetup.js';

describe('licensesAccepted', () => {
  const HASH = '24333f8a63b6825ea9c5514f83c2829b004d1fee';

  it('is true once the license file holds an accepted hash', () => {
    expect(licensesAccepted(`\n${HASH}\n`)).toBe(true);
    expect(licensesAccepted(`8933bad161af4178b1185d1a37fbf41ea5269c55\n${HASH}`)).toBe(true);
  });

  it('is false for a missing, empty or malformed file', () => {
    expect(licensesAccepted(null)).toBe(false);
    expect(licensesAccepted('')).toBe(false);
    expect(licensesAccepted('\n\n')).toBe(false);
    expect(licensesAccepted('not a hash')).toBe(false);
    expect(licensesAccepted('24333f8a')).toBe(false);
  });

  it('copes with Windows line endings', () => {
    expect(licensesAccepted(`${HASH}\r\n`)).toBe(true);
  });
});

describe('parsePackageRevision', () => {
  it('reads the revision from a source.properties file', () => {
    const text = [
      'Pkg.Desc=Android Emulator',
      'Pkg.UserSrc=false',
      'Pkg.Revision=35.4.9',
      'Pkg.Path=emulator',
    ].join('\n');
    expect(parsePackageRevision(text)).toBe('35.4.9');
  });

  it('reads a revision written with spaces and Windows line endings', () => {
    expect(parsePackageRevision('Pkg.Revision = 36.0.0\r\nPkg.Path=x\r\n')).toBe('36.0.0');
  });

  it('is null when there is no revision line', () => {
    expect(parsePackageRevision('Pkg.Path=emulator')).toBeNull();
    expect(parsePackageRevision('')).toBeNull();
    expect(parsePackageRevision(null)).toBeNull();
  });
});

describe('defaultSdkInstallRoot', () => {
  it('is the folder Android Studio would use on each OS', () => {
    expect(
      defaultSdkInstallRoot(
        'win32',
        { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' },
        'C:\\Users\\me',
      ),
    ).toBe('C:\\Users\\me\\AppData\\Local\\Android\\Sdk');
    expect(defaultSdkInstallRoot('darwin', {}, '/Users/me')).toBe('/Users/me/Library/Android/sdk');
    expect(defaultSdkInstallRoot('linux', {}, '/home/me')).toBe('/home/me/Android/Sdk');
  });

  it('falls back to the home folder on Windows when LOCALAPPDATA is not set', () => {
    expect(defaultSdkInstallRoot('win32', {}, 'C:\\Users\\me')).toBe(
      'C:\\Users\\me\\AppData\\Local\\Android\\Sdk',
    );
  });
});
