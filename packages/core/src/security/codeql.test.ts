import { describe, expect, it } from 'vitest';
import type { SupportedOS } from '../cli/registry.js';
import {
  CODEQL_REPO,
  codeqlAssetName,
  codeqlBinaryName,
  codeqlChecksumAssetName,
  codeqlChecksumUrl,
  codeqlDownloadUrl,
  parseChecksumFile,
} from './codeql.js';

const PLATFORMS: SupportedOS[] = ['win32', 'darwin', 'linux'];

describe('codeql release assets', () => {
  it('picks the per-platform asset, not the four-times-larger all-platforms zip', () => {
    expect(codeqlAssetName('win32')).toBe('codeql-win64.zip');
    expect(codeqlAssetName('darwin')).toBe('codeql-osx64.zip');
    expect(codeqlAssetName('linux')).toBe('codeql-linux64.zip');
  });

  it('names the sibling checksum file after the asset', () => {
    for (const platform of PLATFORMS) {
      expect(codeqlChecksumAssetName(platform)).toBe(codeqlAssetName(platform) + '.checksum.txt');
    }
  });

  it('names the binary per platform', () => {
    expect(codeqlBinaryName('win32')).toBe('codeql.exe');
    expect(codeqlBinaryName('darwin')).toBe('codeql');
    expect(codeqlBinaryName('linux')).toBe('codeql');
  });

  it('builds download urls that point at the release tag', () => {
    expect(codeqlDownloadUrl('v2.26.4', 'win32')).toBe(
      `https://github.com/${CODEQL_REPO}/releases/download/v2.26.4/codeql-win64.zip`,
    );
    expect(codeqlChecksumUrl('v2.26.4', 'linux')).toBe(
      `https://github.com/${CODEQL_REPO}/releases/download/v2.26.4/codeql-linux64.zip.checksum.txt`,
    );
  });
});

describe('parseChecksumFile', () => {
  const digest = '7066f60b3f3e1c0f6c2b5d4a9e8f7061524334455667788990aabbccddeeff00';

  it('reads the digest out of "<sha256>  <filename>"', () => {
    expect(parseChecksumFile(`${digest}  codeql-win64.zip`)).toBe(digest);
  });

  it('lowercases an uppercase digest, since the comparison is on the string', () => {
    expect(parseChecksumFile(digest.toUpperCase())).toBe(digest);
  });

  it('finds the digest on a later line, or with surrounding noise', () => {
    expect(parseChecksumFile(`# generated\n${digest} *codeql-osx64.zip\n`)).toBe(digest);
  });

  it('returns null when there is no digest to read', () => {
    expect(parseChecksumFile('')).toBeNull();
    expect(parseChecksumFile('404: Not Found')).toBeNull();
    // Too short, and too long, are both "not a sha256" rather than "close enough".
    expect(parseChecksumFile('a'.repeat(63))).toBeNull();
    expect(parseChecksumFile('a'.repeat(65))).toBeNull();
    // Hex only: a 64-character string with a non-hex letter in it is something else.
    expect(parseChecksumFile('z'.repeat(64))).toBeNull();
  });
});
