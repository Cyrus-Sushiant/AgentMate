import { join } from 'node:path';

// Playwright loads these files as CommonJS (the package has no "type": "module"), so __dirname
// is what's available here, not import.meta.
export const APP_ROOT = join(__dirname, '..');
export const E2E_OUT_DIR = join(APP_ROOT, 'out-e2e');
