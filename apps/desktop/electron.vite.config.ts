import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

// externalizeDepsPlugin() alone has been unreliable at keeping `electron`
// itself external on this Vite/electron-vite version (it got inlined,
// which breaks `app`/`BrowserWindow` since they resolve to the npm
// install-shim instead of Electron's native runtime hook). Force node
// built-ins, electron, and native modules external explicitly as a backstop.
const forcedExternals = [
  'electron',
  'node-pty',
  'better-sqlite3',
  /^node:/,
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: forcedExternals,
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: forcedExternals,
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
        },
        output: {
          // Electron's sandboxed preload loader (sandbox: true) cannot load
          // ESM — it needs CommonJS, unlike the main process which supports ESM.
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
      },
    },
    plugins: [react()],
  },
});
