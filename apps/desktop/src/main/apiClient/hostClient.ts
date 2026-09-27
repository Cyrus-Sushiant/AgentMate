import { randomUUID } from 'node:crypto';
import type {
  ApiEngine,
  EngineEvent,
  EngineRun,
  EngineRunInput,
  EngineRunSummary,
} from './engine/types';
import { type MainToHost, parseHostMessage } from './hostProtocol';

/**
 * Main's side of the utility process that runs requests. Scripts in a collection someone
 * imported are code from elsewhere, and a runaway one must not freeze the window or take main
 * down with it, so they run in a process of their own. This keeps track of that process: it is
 * started on the first request, shared by every request after that, restarted if it dies, and
 * stopped again once nothing has used it for a while.
 */

/** The parts of Electron's UtilityProcess this needs, so a fake can stand in for it in tests. */
export interface HostProcess {
  postMessage(message: unknown): void;
  on(event: 'message', listener: (message: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  kill(): boolean;
}

export interface HostEngineOptions {
  spawn: () => HostProcess;
  readyTimeoutMs?: number;
  idleTimeoutMs?: number;
}

export interface HostEngine extends ApiEngine {
  shutdown(): void;
}

interface PendingRun {
  runId: string;
  input: EngineRunInput;
  onEvent: (event: EngineEvent) => void;
  resolve: (summary: EngineRunSummary) => void;
  sent: boolean;
}

const READY_TIMEOUT_MS = 15_000;
const IDLE_TIMEOUT_MS = 10 * 60_000;

function failed(error: string | null, cancelled = false): EngineRunSummary {
  return { error, cancelled, environment: [], globals: [], collectionVariables: [] };
}

export function createHostEngine(options: HostEngineOptions): HostEngine {
  const readyTimeoutMs = options.readyTimeoutMs ?? READY_TIMEOUT_MS;
  const idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS;

  let host: HostProcess | null = null;
  let ready = false;
  let readyTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const runs = new Map<string, PendingRun>();

  function settle(runId: string, summary: EngineRunSummary): void {
    const run = runs.get(runId);
    if (!run) return;
    runs.delete(runId);
    run.resolve(summary);
    if (runs.size === 0) scheduleIdle();
  }

  function settleAll(summary: EngineRunSummary): void {
    for (const runId of [...runs.keys()]) settle(runId, summary);
  }

  function send(message: MainToHost): void {
    host?.postMessage(message);
  }

  function flush(): void {
    if (!ready) return;
    for (const run of runs.values()) {
      if (run.sent) continue;
      run.sent = true;
      send({ type: 'run', runId: run.runId, input: run.input });
    }
  }

  function clearTimers(): void {
    if (readyTimer) clearTimeout(readyTimer);
    if (idleTimer) clearTimeout(idleTimer);
    readyTimer = null;
    idleTimer = null;
  }

  function stopHost(): void {
    clearTimers();
    const current = host;
    host = null;
    ready = false;
    current?.kill();
  }

  function scheduleIdle(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (runs.size === 0) stopHost();
    }, idleTimeoutMs);
  }

  function ensureHost(): void {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (host) return;

    const child = options.spawn();
    host = child;
    ready = false;
    readyTimer = setTimeout(() => {
      if (host !== child || ready) return;
      stopHost();
      settleAll(failed('The request engine did not start in time.'));
    }, readyTimeoutMs);

    child.on('message', (raw) => {
      if (host !== child) return;
      const message = parseHostMessage(raw);
      if (!message) return;
      switch (message.type) {
        case 'ready':
          ready = true;
          if (readyTimer) clearTimeout(readyTimer);
          readyTimer = null;
          flush();
          break;
        case 'event':
          runs.get(message.runId)?.onEvent(message.event);
          break;
        case 'done':
          settle(message.runId, message.summary);
          break;
        case 'fatal':
          settleAll(failed(message.error));
          break;
      }
    });

    child.on('exit', () => {
      if (host !== child) return;
      host = null;
      ready = false;
      clearTimers();
      settleAll(failed('The request engine stopped unexpectedly. Try sending again.'));
    });
  }

  return {
    run(input, onEvent): EngineRun {
      const runId = randomUUID();
      const done = new Promise<EngineRunSummary>((resolve) => {
        runs.set(runId, { runId, input, onEvent, resolve, sent: false });
      });
      ensureHost();
      flush();
      return {
        cancel() {
          const run = runs.get(runId);
          if (!run) return;
          if (run.sent) send({ type: 'cancel', runId });
          else settle(runId, failed(null, true));
        },
        done,
      };
    },
    shutdown() {
      stopHost();
      settleAll(failed(null, true));
    },
  };
}
