import { describe, expect, it } from 'vitest';
import { osSupport, parseOsRelease, releaseRidFor } from './osSupport';

/**
 * The core supports the Debian family (Ubuntu LTS, Debian stable) and the RHEL family (RHEL,
 * Rocky, Alma, CentOS Stream) on x64 and arm64. Anything else gets a clear "not supported" before
 * a single command runs as root.
 */

const ubuntu = `PRETTY_NAME="Ubuntu 24.04.1 LTS"
NAME="Ubuntu"
VERSION_ID="24.04"
ID=ubuntu
ID_LIKE=debian
`;

const rocky = `NAME="Rocky Linux"
VERSION="9.4 (Blue Onyx)"
ID="rocky"
ID_LIKE="rhel centos fedora"
VERSION_ID="9.4"
PRETTY_NAME="Rocky Linux 9.4 (Blue Onyx)"
`;

describe('parseOsRelease', () => {
  it('reads plain, double-quoted and single-quoted values', () => {
    expect(parseOsRelease(ubuntu)).toMatchObject({
      ID: 'ubuntu',
      VERSION_ID: '24.04',
      PRETTY_NAME: 'Ubuntu 24.04.1 LTS',
    });
    expect(parseOsRelease("NAME='Plain Linux'\n# a comment\n\nID=plain")).toEqual({
      NAME: 'Plain Linux',
      ID: 'plain',
    });
  });

  it('unescapes quoted characters', () => {
    expect(parseOsRelease('PRETTY_NAME="Say \\"hi\\" \\$HOME"').PRETTY_NAME).toBe('Say "hi" $HOME');
  });
});

describe('osSupport', () => {
  it.each([
    ['ubuntu', '22.04', 'debian'],
    ['ubuntu', '24.04', 'debian'],
    ['ubuntu', '26.04', 'debian'],
    ['debian', '12', 'debian'],
    ['debian', '13', 'debian'],
    ['rhel', '9.4', 'rhel'],
    ['rocky', '9.4', 'rhel'],
    ['rocky', '10.0', 'rhel'],
    ['almalinux', '10.1', 'rhel'],
    ['centos', '9', 'rhel'],
  ])('supports %s %s', (id, version, family) => {
    expect(osSupport({ ID: id, VERSION_ID: version, PRETTY_NAME: `${id} ${version}` })).toEqual({
      supported: true,
      family,
      name: `${id} ${version}`,
    });
  });

  it.each([
    ['ubuntu', '23.10'],
    ['debian', '11'],
    ['rocky', '8.9'],
    ['alpine', '3.20'],
    ['arch', ''],
  ])('explains that %s %s is not supported', (id, version) => {
    const support = osSupport({ ID: id, VERSION_ID: version, PRETTY_NAME: `${id} ${version}` });

    expect(support.supported).toBe(false);
    expect(support.reason).toMatch(/not supported/);
    expect(support.reason).toContain('Ubuntu 22.04, 24.04 or 26.04');
  });

  it('reads the family from the real files', () => {
    expect(osSupport(parseOsRelease(rocky))).toMatchObject({ supported: true, family: 'rhel' });
  });
});

describe('releaseRidFor', () => {
  it.each([
    ['x86_64', 'linux-x64'],
    ['amd64', 'linux-x64'],
    ['aarch64', 'linux-arm64'],
    ['arm64', 'linux-arm64'],
  ])('maps %s to %s', (machine, rid) => {
    expect(releaseRidFor(machine)).toBe(rid);
  });

  it.each([['armv7l'], ['i686'], ['riscv64'], ['']])('has no build for %s', (machine) => {
    expect(releaseRidFor(machine)).toBeNull();
  });
});
