import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveRipgrepPath, ripgrepPath } from './ripgrepPath';

/**
 * Where the bundled ripgrep lives. In a packaged build it sits in app.asar.unpacked, because a
 * program cannot be started from inside the archive.
 */

function resolverFor(found: string) {
  return (id: string): string => {
    if (id === '@vscode/ripgrep') return found.replace(/rg(\.exe)?$/, 'lib/index.js');
    return found;
  };
}

describe('resolveRipgrepPath', () => {
  it('points a packaged path at the unpacked copy', () => {
    const packed =
      'C:\\App\\resources\\app.asar\\node_modules\\@vscode\\ripgrep-win32-x64\\bin\\rg.exe';
    expect(
      resolveRipgrepPath({
        platform: 'win32',
        arch: 'x64',
        resolve: resolverFor(packed),
        exists: () => true,
      }),
    ).toBe(
      'C:\\App\\resources\\app.asar.unpacked\\node_modules\\@vscode\\ripgrep-win32-x64\\bin\\rg.exe',
    );

    const posix = '/opt/App/resources/app.asar/node_modules/@vscode/ripgrep-linux-x64/bin/rg';
    expect(
      resolveRipgrepPath({
        platform: 'linux',
        arch: 'x64',
        resolve: resolverFor(posix),
        exists: () => true,
      }),
    ).toBe('/opt/App/resources/app.asar.unpacked/node_modules/@vscode/ripgrep-linux-x64/bin/rg');
  });

  it('leaves an unpacked or development path alone', () => {
    const dev = '/work/node_modules/@vscode/ripgrep-darwin-arm64/bin/rg';
    expect(
      resolveRipgrepPath({
        platform: 'darwin',
        arch: 'arm64',
        resolve: resolverFor(dev),
        exists: () => true,
      }),
    ).toBe(dev);
  });

  it('asks for the package that matches the platform', () => {
    const asked: string[] = [];
    resolveRipgrepPath({
      platform: 'win32',
      arch: 'arm64',
      resolve: (id) => {
        asked.push(id);
        return '/x/lib/index.js';
      },
      exists: () => true,
    });
    expect(asked).toContain('@vscode/ripgrep-win32-arm64/bin/rg.exe');
  });

  it('falls back to the copy the app ships beside it', () => {
    // A packaged app flattens node_modules, so the platform package sits at the top level.
    const shipped = '/opt/App/resources/app.asar/node_modules/@vscode/ripgrep-linux-x64/bin/rg';
    expect(
      resolveRipgrepPath({
        platform: 'linux',
        arch: 'x64',
        resolve: (id, from) => {
          if (from) throw new Error('not beside the wrapper');
          if (id === '@vscode/ripgrep') return '/opt/App/lib/index.js';
          return shipped;
        },
        exists: () => true,
      }),
    ).toBe('/opt/App/resources/app.asar.unpacked/node_modules/@vscode/ripgrep-linux-x64/bin/rg');
  });

  it('gives null when the binary is not installed', () => {
    expect(
      resolveRipgrepPath({
        platform: 'linux',
        arch: 'x64',
        resolve: () => {
          throw new Error('Cannot find module');
        },
        exists: () => true,
      }),
    ).toBeNull();
    expect(
      resolveRipgrepPath({
        platform: 'linux',
        arch: 'x64',
        resolve: resolverFor('/x/bin/rg'),
        exists: () => false,
      }),
    ).toBeNull();
  });
});

describe('ripgrepPath', () => {
  it('finds the binary installed with the app', () => {
    const path = ripgrepPath();
    expect(path).not.toBeNull();
    expect(existsSync(path as string)).toBe(true);
  });
});
