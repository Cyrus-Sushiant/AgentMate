import { join } from 'node:path';

// Playwright loads these files as CommonJS (the package has no "type": "module"), so __dirname
// is what's available here, not import.meta.
export const APP_ROOT = join(__dirname, '..');
export const E2E_OUT_DIR = join(APP_ROOT, 'out-e2e');

/**
 * Where the app's own stdout/stderr and the terminal host's log are kept, next to the Playwright
 * report so CI uploads them. Main-process warnings never reach the renderer, so without these a
 * failure on another OS has nothing behind it but a screenshot.
 */
export const MAIN_LOG_DIR = join(APP_ROOT, 'test-results', 'main-process');
