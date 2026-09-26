import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const path = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

/**
 * Two suites in one run.
 *
 * "main" is the Electron main process plus the code it shares with the renderer. It runs in Node,
 * with `electron` and `better-sqlite3` swapped for the stand-ins in src/test/main: the real ones
 * need an Electron process, and better-sqlite3 gets rebuilt for Electron's ABI by `pnpm dev`,
 * after which plain Node can no longer load it.
 *
 * "renderer" is React, in jsdom, with the browser APIs and the heavy editors stubbed.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path('./src/renderer/src'),
      '@shared': path('./src/shared'),
    },
  },
  test: {
    reporters: process.env.CI
      ? ['default', 'github-actions', ['junit', { outputFile: 'test-results/unit-junit.xml' }]]
      : ['default'],
    projects: [
      {
        extends: true,
        resolve: {
          alias: {
            electron: path('./src/test/main/electronMock.ts'),
            'better-sqlite3': path('./src/test/main/sqliteShim.ts'),
          },
        },
        test: {
          name: 'main',
          environment: 'node',
          include: [
            // Top-level checks that read the whole source tree, like cliSettingsContract.test.ts.
            'src/*.test.ts',
            'src/main/**/*.test.ts',
            'src/shared/**/*.test.ts',
            'src/preload/**/*.test.ts',
          ],
          setupFiles: ['src/test/main/setup.ts'],
          // Some of these start real servers, spawn git or open a pty.
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
      {
        extends: true,
        resolve: {
          alias: {
            'monaco-editor': path('./src/test/renderer/mocks/monaco.ts'),
            '@devolutions/iron-remote-desktop': path('./src/test/renderer/mocks/ironRdp.ts'),
            '@devolutions/iron-remote-desktop-rdp': path('./src/test/renderer/mocks/ironRdp.ts'),
            'framer-motion': path('./src/test/renderer/mocks/framerMotion.tsx'),
          },
        },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test/renderer/setup.ts'],
          testTimeout: 15_000,
          // The first beforeEach in a file imports every store module (see resetAllStoresAsync),
          // which under a full parallel run can pass the 10s default.
          hookTimeout: 20_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/testing/**',
        'src/test/**',
        // shadcn primitives, generated icon sets and pure type modules.
        'src/renderer/src/components/ui/**',
        'src/renderer/src/components/icons.tsx',
        'src/shared/apiTypes.ts',
        // Entry points, window wiring and workers: the end-to-end suite covers these instead.
        'src/main/index.ts',
        'src/main/vault/index.ts',
        'src/renderer/src/main.tsx',
        'src/main/usage/usageScanWorker.ts',
        'src/main/security/codeqlExtractWorker.ts',
        'src/main/ptyHost/hostEntry.ts',
        // Interface declarations with no runtime code of their own.
        'src/main/vault/ports.ts',
      ],
      reporter: ['text-summary', 'text', 'lcov', 'json-summary'],
      // A floor that holds the line at what is covered today, not a target. Raise it as the
      // renderer components get their tests, rather than leaving it where it is.
      thresholds: {
        lines: 44,
        statements: 43,
        functions: 42,
        branches: 36,
        'src/main/**': { lines: 49, statements: 48, functions: 48, branches: 42 },
        'src/renderer/**': { lines: 37, statements: 36, functions: 34, branches: 32 },
        'src/shared/**': { lines: 95, statements: 95, functions: 95, branches: 90 },
        'src/preload/**': { lines: 90, statements: 90, functions: 90, branches: 65 },
        // The Vault was built test-first and holds its own bar.
        'src/main/vault/**': { lines: 90, statements: 90, functions: 90, branches: 80 },
        'src/main/ipc/vault.ts': { lines: 90, statements: 90, functions: 90, branches: 80 },
        // The write side of this one runs during a real backup, which the e2e suite covers.
        'src/main/backup/vaultSection.ts': {
          lines: 90,
          statements: 90,
          functions: 70,
          branches: 45,
        },
        'src/renderer/src/components/vault/**': { lines: 80, functions: 75, branches: 70 },
        'src/renderer/src/lib/vault/**': { lines: 80, functions: 75, branches: 70 },
        'src/renderer/src/stores/vaultStore.ts': { lines: 80, functions: 75, branches: 45 },
        'src/renderer/src/pages/VaultPage.tsx': { lines: 80, functions: 75, branches: 70 },
        // The security-sensitive modules, where a silent mistake matters most.
        'src/main/crypto/**': { lines: 90, branches: 85 },
        'src/main/backup/envelope.ts': { lines: 85, branches: 75 },
        'src/main/pathGuard.ts': { lines: 95, branches: 90 },
        'src/main/ptyHost/protocol.ts': { lines: 90, branches: 80 },
        'src/main/remote/tokens.ts': { lines: 90, branches: 80 },
        'src/main/usage/logParsers.ts': { lines: 80, branches: 70 },
        'src/main/rdp/rdcleanpath.ts': { lines: 85, branches: 75 },
      },
    },
  },
});
