import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

interface ResolveOptions {
  platform: NodeJS.Platform;
  arch: string;
  /** `require.resolve` from the app. */
  resolve: (id: string, from?: string) => string;
  exists: (path: string) => boolean;
}

/**
 * The ripgrep binary for this platform, or null when it is not installed.
 *
 * `@vscode/ripgrep` throws on import when its platform package is missing, which would take
 * the whole main process down with it. So this finds the binary the same way that module does,
 * without importing it. In development the platform package is resolved from inside
 * `@vscode/ripgrep`, since pnpm only lets a package see its own dependencies. A packaged app
 * lists the platform packages as its own optional dependencies (electron-builder does not
 * follow pnpm's nested ones), so there it is found from the app itself.
 */
export function resolveRipgrepPath(options: ResolveOptions): string | null {
  const binary = options.platform === 'win32' ? 'rg.exe' : 'rg';
  const id = `@vscode/ripgrep-${options.platform}-${options.arch}/bin/${binary}`;
  let path: string | null = null;
  try {
    path = options.resolve(id, options.resolve('@vscode/ripgrep'));
  } catch {
    try {
      path = options.resolve(id);
    } catch {
      return null;
    }
  }
  // A program cannot run from inside the archive, so packaging keeps a real copy beside it.
  const unpacked = path.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2');
  return options.exists(unpacked) ? unpacked : null;
}

let cached: string | null | undefined;

export function ripgrepPath(): string | null {
  if (cached !== undefined) return cached;
  const require = createRequire(import.meta.url);
  cached = resolveRipgrepPath({
    platform: process.platform,
    arch: process.arch,
    resolve: (id, from) => (from ? createRequire(from).resolve(id) : require.resolve(id)),
    exists: existsSync,
  });
  return cached;
}
