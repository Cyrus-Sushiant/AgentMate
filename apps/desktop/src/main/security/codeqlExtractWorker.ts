import { parentPort, workerData } from 'node:worker_threads';
import AdmZip from 'adm-zip';

// Worker-thread entry for unpacking the CodeQL zip. The archive is around 400 MB compressed and
// several thousand files, so extracting it on the main process locks up every other IPC handler
// for the best part of a minute, which for a feature whose whole point is showing live progress
// is exactly the wrong outcome. Same reasoning, and same shape, as usageScanWorker.
// Must not import `electron`.

export interface ExtractWorkerInput {
  zipPath: string;
  destDir: string;
}

export type ExtractWorkerMessage =
  | { kind: 'progress'; done: number; total: number }
  | { kind: 'done' }
  | { kind: 'error'; error: string };

const input = workerData as ExtractWorkerInput;

try {
  const zip = new AdmZip(input.zipPath);
  const entries = zip.getEntries();
  const total = entries.length;
  let done = 0;
  // Reporting every entry would post thousands of messages; every 1% is enough to animate a bar.
  const step = Math.max(1, Math.floor(total / 100));

  for (const entry of entries) {
    if (!entry.isDirectory) {
      // Extract file by file rather than with extractAllTo, so progress is real rather than a
      // guess, and so one bad entry names itself instead of failing the whole archive silently.
      zip.extractEntryTo(entry, input.destDir, true, true);
    }
    done += 1;
    if (done % step === 0 || done === total) {
      parentPort?.postMessage({ kind: 'progress', done, total } satisfies ExtractWorkerMessage);
    }
  }

  parentPort?.postMessage({ kind: 'done' } satisfies ExtractWorkerMessage);
} catch (err) {
  const error = err instanceof Error ? err.message : String(err);
  parentPort?.postMessage({ kind: 'error', error } satisfies ExtractWorkerMessage);
}
