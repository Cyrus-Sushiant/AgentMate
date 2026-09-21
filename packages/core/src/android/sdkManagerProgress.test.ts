import { describe, expect, it } from 'vitest';
import { isLicensePrompt, parseSdkManagerProgress } from './sdkManager.js';

/**
 * `sdkmanager` reports a download by repainting one progress line, and stops dead on a license
 * prompt waiting for stdin. Both have to be recognised: the first so the UI can show something
 * moving through a multi-hundred-megabyte download, the second so it does not hang forever.
 */

describe('parseSdkManagerProgress', () => {
  it('reads the percent and what it is doing', () => {
    expect(
      parseSdkManagerProgress('[=========                     ] 25% Downloading x86_64.zip'),
    ).toEqual({ percent: 25, label: 'Downloading x86_64.zip' });
  });

  it('reads a bar with no label and one at the ends of its range', () => {
    expect(parseSdkManagerProgress('[                              ] 0% ')).toMatchObject({
      percent: 0,
    });
    expect(parseSdkManagerProgress('[==============================] 100% Unzipping...')).toEqual({
      percent: 100,
      label: 'Unzipping...',
    });
  });

  it('ignores anything that is not a progress line', () => {
    for (const line of [
      '',
      'Warning: Failed to read or create install properties file.',
      'License android-sdk-license:',
      'Accept? (y/N): ',
      '  system-images;android-34;google_apis;x86_64 | 12 | Google APIs | x',
    ]) {
      expect(parseSdkManagerProgress(line), line).toBeNull();
    }
  });
});

describe('isLicensePrompt', () => {
  it('spots the question sdkmanager blocks on', () => {
    expect(isLicensePrompt('Accept? (y/N): ')).toBe(true);
    expect(isLicensePrompt('    Accept? (y/N):')).toBe(true);
    // The licences run is worded differently but blocks the same way.
    expect(isLicensePrompt('Review license that has not been accepted (y/N)?')).toBe(true);
  });

  it('does not mistake ordinary output for a prompt', () => {
    expect(isLicensePrompt('Downloading system image')).toBe(false);
    expect(isLicensePrompt('License android-sdk-license:')).toBe(false);
  });
});
