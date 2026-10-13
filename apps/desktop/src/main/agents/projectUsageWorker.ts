import { parentPort, workerData } from 'node:worker_threads';
import { type ScanInput, type ScanOutput, scanProjectBuckets } from './projectUsageScan';

// Worker-thread entry for the project usage report. A long-lived project is hundreds of MB of
// session transcripts, and parsing them on the main process freezes every other IPC handler,
// the same trouble usageScanWorker.ts exists for. It posts one plain-object result back. Must
// not import `electron`.

export type ProjectUsageWorkerMessage =
  | { ok: true; result: ScanOutput }
  | { ok: false; error: string };

scanProjectBuckets(workerData as ScanInput)
  .then((result) => {
    parentPort?.postMessage({ ok: true, result } satisfies ProjectUsageWorkerMessage);
  })
  .catch((err: unknown) => {
    const error = err instanceof Error ? err.message : String(err);
    parentPort?.postMessage({ ok: false, error } satisfies ProjectUsageWorkerMessage);
  });
