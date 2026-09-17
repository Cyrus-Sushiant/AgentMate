import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests drive the built desktop app through Electron. Each test gets its own user
 * data folder, so they never touch a real install or a running dev instance.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  globalSetup: './globalSetup.ts',
  // One Electron at a time: every instance starts its own terminal host and CLI probes.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: '../test-results/e2e',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
