import { describe, expect, it } from 'vitest';
import { requestedImages, testServerImages } from './testServers';

describe('choosing the test servers a system test runs on', () => {
  it('keeps each test on its own defaults when nothing is asked for', () => {
    expect(requestedImages(undefined)).toBeNull();
    expect(requestedImages('  ')).toBeNull();
    expect(
      testServerImages(['ubuntu-24.04', 'debian-13', 'rocky-9'], ['ubuntu-24.04'], undefined),
    ).toEqual(['ubuntu-24.04']);
  });

  it('runs only the asked-for images a test supports, in the test order', () => {
    const asked = 'rocky-9, debian-13,ubuntu-24.04-ufw';
    expect(requestedImages(asked)).toEqual(['rocky-9', 'debian-13', 'ubuntu-24.04-ufw']);
    expect(
      testServerImages(['ubuntu-24.04', 'debian-13', 'rocky-9'], ['ubuntu-24.04'], asked),
    ).toEqual(['debian-13', 'rocky-9']);
    expect(testServerImages(['rocky-9-firewalld'], ['rocky-9-firewalld'], asked)).toEqual([]);
  });

  it('refuses an image name it does not know, so a typo in a workflow cannot skip everything', () => {
    expect(() => requestedImages('ubuntu-22.04')).toThrow(/ubuntu-22\.04/);
  });
});
