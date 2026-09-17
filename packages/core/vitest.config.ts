import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Coverage is enforced where it was written test-first. Widen `include` as other areas
      // get the same treatment.
      include: ['src/vault/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text-summary', 'text', 'lcov'],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 90 },
    },
  },
});
