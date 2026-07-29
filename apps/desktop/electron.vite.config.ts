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
  // Local speech-to-text. transformers.js pulls in onnxruntime-node, which
  // dlopen's prebuilt native binaries, so it must stay external. Otherwise
  // Rollup tries to bundle the .node/.dll files.
  '@huggingface/transformers',
  'onnxruntime-node',
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
          // Separate entry: local-log usage scanning runs in a worker thread so
          // parsing hundreds of MB of CLI transcripts can't block main-process
          // IPC. Loaded by path from main, so it needs its own bundle.
          usageScanWorker: resolve(__dirname, 'src/main/usage/usageScanWorker.ts'),
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
          // ESM. It needs CommonJS, unlike the main process which supports ESM.
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
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    plugins: [react()],
  },
});
