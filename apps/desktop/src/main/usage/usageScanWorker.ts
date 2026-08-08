import { parentPort, workerData } from 'node:worker_threads';
import {
  scanProviderLogs,
  type LocalLogProvider,
  type ScanCache,
  type ScanResult,
} from './logParsers';

// Worker-thread entry for local-log usage scans. Parsing a few hundred MB of
// session transcripts is seconds of solid CPU work; doing it on the main process
// froze every other IPC handler (usage cards never resolved, "Add to desktop"
// never fired). It runs here instead, and posts a single plain-object result
// back. Must not import `electron`.

export interface ScanWorkerInput {
  provider: LocalLogProvider;
  cache: ScanCache;
  sinceMs: number;
}

export type ScanWorkerMessage = { ok: true; result: ScanResult } | { ok: false; error: string };

const input = workerData as ScanWorkerInput;

scanProviderLogs(input.provider, input.cache, input.sinceMs)
  .then((result) => {
    parentPort?.postMessage({ ok: true, result } satisfies ScanWorkerMessage);
  })
  .catch((err: unknown) => {
    const error = err instanceof Error ? err.message : String(err);
    parentPort?.postMessage({ ok: false, error } satisfies ScanWorkerMessage);
  });
