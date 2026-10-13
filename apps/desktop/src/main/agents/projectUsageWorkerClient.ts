import { existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { ScanInput, ScanOutput } from './projectUsageScan';
import type { ProjectUsageWorkerMessage } from './projectUsageWorker';

// Runs projectUsageWorker.mjs for one scan and waits for its answer, the way localScanner.ts
// runs the Usage page's worker. A scan that never answers is cut off instead of leaving the
// Usage tab on its skeleton for good.

const WORKER_TIMEOUT_MS = 120_000;

/**
 * Resolve the bundled worker script. Packaged builds unpack it from the asar archive (see
 * `asarUnpack` in electron-builder.yml) because the Node worker loader reads it off disk.
 */
function workerScriptPath(): string | null {
  const bundled = join(__dirname, 'projectUsageWorker.mjs');
  const unpacked = bundled.replace(`app.asar${sep}`, `app.asar.unpacked${sep}`);
  if (unpacked !== bundled && existsSync(unpacked)) return unpacked;
  return existsSync(bundled) ? bundled : null;
}

export function runProjectScan(input: ScanInput): Promise<ScanOutput> {
  const script = workerScriptPath();
  if (!script) return Promise.reject(new Error('project usage worker not found'));

  return new Promise<ScanOutput>((resolve, reject) => {
    const worker = new Worker(script, { workerData: input });
    let settled = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      fn();
    };
    const timer = setTimeout(
      () => settle(() => reject(new Error('project usage scan timed out'))),
      WORKER_TIMEOUT_MS,
    );

    worker.on('message', (msg: ProjectUsageWorkerMessage) => {
      settle(() => (msg.ok ? resolve(msg.result) : reject(new Error(msg.error))));
    });
    worker.on('error', (err) => settle(() => reject(err)));
    worker.on('exit', (code) => {
      settle(() =>
        reject(new Error(`project usage worker exited before reporting (code ${code})`)),
      );
    });
  });
}
