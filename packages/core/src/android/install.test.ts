import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { explainInstallFailure, parseAdbInstallResult } from './install.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf-8');

describe('parseAdbInstallResult', () => {
  it('reads a streamed install that worked', () => {
    expect(parseAdbInstallResult(fixture('adb-install-success.txt'), '')).toEqual({
      ok: true,
      code: null,
      message: '',
    });
  });

  it('pulls the INSTALL_FAILED code out of the failure line', () => {
    const result = parseAdbInstallResult(fixture('adb-install-failure.txt'), '');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INSTALL_FAILED_UPDATE_INCOMPATIBLE');
    expect(result.message).toContain('signatures do not match');
  });

  it('reads the failure from stderr, which is where adb usually puts it', () => {
    const stderr = 'adb: failed to install x.apk: Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]';
    expect(parseAdbInstallResult('', stderr)).toMatchObject({
      ok: false,
      code: 'INSTALL_FAILED_INSUFFICIENT_STORAGE',
    });
  });

  it('does not claim success on empty output', () => {
    expect(parseAdbInstallResult('', '').ok).toBe(false);
  });
});

describe('explainInstallFailure', () => {
  it('turns the common codes into something actionable', () => {
    expect(explainInstallFailure('INSTALL_FAILED_UPDATE_INCOMPATIBLE')).toMatch(/signed/i);
    expect(explainInstallFailure('INSTALL_FAILED_VERSION_DOWNGRADE')).toMatch(/newer/i);
    expect(explainInstallFailure('INSTALL_FAILED_NO_MATCHING_ABIS')).toMatch(/processor|abi/i);
    expect(explainInstallFailure('INSTALL_FAILED_INSUFFICIENT_STORAGE')).toMatch(/space|storage/i);
  });

  it('falls back to the raw code rather than inventing an explanation', () => {
    expect(explainInstallFailure('INSTALL_FAILED_SOMETHING_NEW')).toContain(
      'INSTALL_FAILED_SOMETHING_NEW',
    );
    expect(explainInstallFailure(null)).toBeTruthy();
  });
});
