import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  test: {
    // Component tests (.tsx) opt into jsdom with a `@vitest-environment jsdom` comment.
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Enforced for the Vault, which was built test-first. Its Electron wiring (vault/index.ts)
      // is exercised by the e2e suite instead.
      include: [
        'src/main/vault/**',
        'src/main/ipc/vault.ts',
        'src/main/backup/vaultSection.ts',
        'src/shared/vaultErrors.ts',
        'src/renderer/src/components/vault/**',
        'src/renderer/src/pages/VaultPage.tsx',
        'src/renderer/src/hooks/useVaultEvents.ts',
        'src/renderer/src/lib/vault/**',
        'src/renderer/src/stores/vaultStore.ts',
      ],
      exclude: ['**/*.test.{ts,tsx}', '**/testing/**', 'src/main/vault/index.ts'],
      reporter: ['text-summary', 'text', 'lcov'],
      thresholds: {
        'src/main/**': { lines: 90, statements: 90, functions: 90, branches: 80 },
        'src/renderer/**': { lines: 80, statements: 80, functions: 75, branches: 70 },
      },
    },
  },
});
