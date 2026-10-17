import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANDROID_REPOSITORY_MANIFEST_URL,
  androidPackagesFor,
  parseCmdlineToolsArchive,
  systemImageAbi,
} from './androidRepository.js';

/**
 * Where to download the Android command-line tools from, and which SDK packages to ask for. The
 * XML is a trimmed copy of the real file Google publishes, so the element names are the real ones.
 * The result is a file that gets downloaded and unpacked, so anything off about the entry means
 * "no archive" rather than a guess.
 */

const XML = readFileSync(new URL('./__fixtures__/repository2-3.xml', import.meta.url), 'utf-8');
const BASE = 'https://dl.google.com/android/repository/';

describe('ANDROID_REPOSITORY_MANIFEST_URL', () => {
  it("is Google's own repository list", () => {
    expect(ANDROID_REPOSITORY_MANIFEST_URL).toBe(`${BASE}repository2-3.xml`);
  });
});

describe('parseCmdlineToolsArchive', () => {
  it('finds the Windows download, with its checksum and size', () => {
    expect(parseCmdlineToolsArchive(XML, 'win32', 'x64')).toEqual({
      revision: '23.0',
      url: `${BASE}commandlinetools-win-16111833_latest.zip`,
      sha1: '57d04f2d75eb8e8fffc5000a987e5de4b5a63e9d',
      size: 154957218,
    });
  });

  it('finds the Linux download', () => {
    expect(parseCmdlineToolsArchive(XML, 'linux', 'x64')).toMatchObject({
      url: `${BASE}commandlinetools-linux-16111833_latest.zip`,
      sha1: 'e025545c62a8e64c7559119566a569fb1dec5f60',
    });
  });

  it('tells an Intel Mac from an Apple silicon one', () => {
    expect(parseCmdlineToolsArchive(XML, 'darwin', 'x64')?.url).toBe(
      `${BASE}commandlinetools-mac_x86_64-16111833_latest.zip`,
    );
    expect(parseCmdlineToolsArchive(XML, 'darwin', 'arm64')?.url).toBe(
      `${BASE}commandlinetools-mac_arm64-16111833_latest.zip`,
    );
  });

  it('uses the one Windows and Linux download for any CPU, since the tools are Java', () => {
    expect(parseCmdlineToolsArchive(XML, 'win32', 'arm64')?.url).toBe(
      `${BASE}commandlinetools-win-16111833_latest.zip`,
    );
    expect(parseCmdlineToolsArchive(XML, 'linux', 'arm64')?.url).toBe(
      `${BASE}commandlinetools-linux-16111833_latest.zip`,
    );
  });

  it('takes the "latest" package, not an older numbered one', () => {
    // Only the numbered 23.0 entry is changed, so "latest" must still be what is read.
    const onlyNumbered = XML.replace(
      /(<remotePackage path="cmdline-tools;23\.0">[\s\S]*?<\/remotePackage>)/,
      (block) => block.replaceAll('16111833', '99999999'),
    );

    expect(parseCmdlineToolsArchive(onlyNumbered, 'win32', 'x64')?.url).toContain('16111833');
  });

  it('has nothing when the latest package is not in the file', () => {
    const without = XML.replace(
      /<remotePackage path="cmdline-tools;latest">[\s\S]*?<\/remotePackage>/,
      '',
    );

    expect(parseCmdlineToolsArchive(without, 'win32', 'x64')).toBeNull();
  });

  it('has nothing for a file that is not the repository list', () => {
    expect(parseCmdlineToolsArchive('', 'win32', 'x64')).toBeNull();
    expect(parseCmdlineToolsArchive('<html>Not found</html>', 'win32', 'x64')).toBeNull();
  });

  describe('refuses an entry that points anywhere unexpected', () => {
    const edited = (from: string, to: string) =>
      parseCmdlineToolsArchive(XML.replaceAll(from, to), 'win32', 'x64');

    it('a checksum that is not a SHA-1', () => {
      expect(edited('57d04f2d75eb8e8fffc5000a987e5de4b5a63e9d', 'zzzz')).toBeNull();
    });

    it('a file name that climbs out of the repository folder', () => {
      expect(edited('commandlinetools-win-16111833_latest.zip', '../evil.zip')).toBeNull();
    });

    it('a file name that is a full address', () => {
      expect(
        edited('commandlinetools-win-16111833_latest.zip', 'https://evil.example/tools.zip'),
      ).toBeNull();
    });

    it('a file that is not a zip', () => {
      expect(edited('commandlinetools-win-16111833_latest.zip', 'tools.exe')).toBeNull();
    });

    it('a size that is not a number', () => {
      expect(edited('<size>154957218</size>', '<size>lots</size>')).toBeNull();
    });
  });
});

describe('systemImageAbi', () => {
  it('is the Intel image on an x64 machine and the ARM image on an ARM one', () => {
    expect(systemImageAbi('x64')).toBe('x86_64');
    expect(systemImageAbi('arm64')).toBe('arm64-v8a');
  });

  it('falls back to x86_64 for a CPU it does not know', () => {
    expect(systemImageAbi('other')).toBe('x86_64');
  });
});

describe('androidPackagesFor', () => {
  it('asks for the tools, the emulator, a platform and an image for this CPU', () => {
    expect(androidPackagesFor('x64')).toEqual({
      'android-platform-tools': 'platform-tools',
      'android-emulator': 'emulator',
      'android-platform': 'platforms;android-36',
      'android-system-image': 'system-images;android-36;google_apis;x86_64',
    });
  });

  it('picks the ARM image on an ARM machine', () => {
    expect(androidPackagesFor('arm64')['android-system-image']).toBe(
      'system-images;android-36;google_apis;arm64-v8a',
    );
  });
});
