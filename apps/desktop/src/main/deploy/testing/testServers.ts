import { it } from 'vitest';
import type { TestServerImage } from './testServerMachines';

/**
 * The test servers for vitest system tests. Everything that starts and looks at them lives in
 * testServerMachines.ts, which has no vitest import, so the Playwright full-stack run can use it
 * too.
 */
export * from './testServerMachines';

/**
 * Call inside a describe that loops over test servers: when the run asked for none of them, it
 * leaves a skipped test behind, since vitest fails a suite that declares no tests at all.
 */
export function skipWhenNoServers(images: readonly TestServerImage[]): void {
  if (images.length === 0) {
    it.skip('runs on none of the test servers asked for', () => {
      // Nothing to run here.
    });
  }
}
