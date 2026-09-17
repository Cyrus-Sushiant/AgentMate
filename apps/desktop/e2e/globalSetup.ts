import { execSync } from 'node:child_process';
import { existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ROOT, E2E_OUT_DIR } from './paths';

/**
 * Builds the app into its own folder so a running `electron-vite dev` (which owns `out/`) is left
 * alone. Set AGENTMATE_E2E_SKIP_BUILD=1 to reuse the last build while iterating on a test.
 */
export default function globalSetup(): void {
  if (process.env.AGENTMATE_E2E_SKIP_BUILD === '1' && existsSync(join(E2E_OUT_DIR, 'main'))) {
    return;
  }
  rmSync(E2E_OUT_DIR, { recursive: true, force: true });
  execSync('pnpm exec electron-vite build --outDir out-e2e', { cwd: APP_ROOT, stdio: 'inherit' });

  // The renderer's root is src/renderer, so its outDir resolves under there. Main loads it from
  // ../renderer next to itself, which is where it has to end up.
  const rendererBuild = join(APP_ROOT, 'src', 'renderer', 'out-e2e');
  if (existsSync(join(rendererBuild, 'renderer'))) {
    rmSync(join(E2E_OUT_DIR, 'renderer'), { recursive: true, force: true });
    renameSync(join(rendererBuild, 'renderer'), join(E2E_OUT_DIR, 'renderer'));
  }
  rmSync(rendererBuild, { recursive: true, force: true });
  if (!existsSync(join(E2E_OUT_DIR, 'renderer', 'index.html'))) {
    throw new Error('e2e build has no renderer/index.html');
  }
}
