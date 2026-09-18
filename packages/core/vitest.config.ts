import { defineConfig } from 'vitest/config';

/** Pure TypeScript, so there is nothing to stub: plain Node, tests beside their source. */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    reporters: process.env.CI
      ? ['default', 'github-actions', ['junit', { outputFile: 'test-results/junit.xml' }]]
      : ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/types.ts', 'src/types/**', 'src/index.ts'],
      reporter: ['text-summary', 'json-summary', 'lcov', 'html'],
      thresholds: {
        // The parsers that turn scanner output into findings, and the skill audit, are the parts
        // where a silent mistake matters most.
        'src/security/**': { lines: 80, branches: 70 },
        'src/skills/securityAudit.ts': { lines: 85, branches: 75 },
        'src/git/**': { lines: 80, branches: 70 },
      },
    },
  },
});
