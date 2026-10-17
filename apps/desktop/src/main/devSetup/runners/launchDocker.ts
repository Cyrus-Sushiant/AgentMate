import type { RunHooks, RunResult } from './packageManagerRunner';

/**
 * Making "Docker is running" true. Starting Docker Desktop is one command; the work is waiting for
 * its engine to answer, which takes a while on a cold start. It does not start a second copy of
 * something that is already answering, and it gives up after a fixed time rather than hang.
 */

const POLL_MS = 3_000;
const GIVE_UP_MS = 150_000;

export interface DockerLauncherDeps {
  /** Starts Docker Desktop and returns straight away, without waiting for the engine. */
  launch: () => Promise<{ ok: boolean; message?: string }>;
  /** Whether the engine answers right now (`docker info` succeeding). */
  ping: () => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

const CANCELLED: RunResult = { ok: false, code: null, cancelled: true };
const OK: RunResult = { ok: true, code: 0, cancelled: false };
const fail = (message: string): RunResult => ({ ok: false, code: null, cancelled: false, message });

export function createDockerLauncher(deps: DockerLauncherDeps): {
  run: (hooks: RunHooks) => Promise<RunResult>;
} {
  return {
    async run(hooks) {
      if (hooks.token.cancelled) return CANCELLED;
      if (await deps.ping()) return OK;

      const launched = await deps.launch();
      if (!launched.ok) return fail(launched.message ?? 'Docker Desktop could not be started.');

      const started = deps.now();
      while (deps.now() - started < GIVE_UP_MS) {
        await deps.sleep(POLL_MS);
        if (hooks.token.cancelled) return CANCELLED;
        const seconds = Math.round((deps.now() - started) / 1000);
        hooks.onProgress({
          phase: 'preparing',
          fraction: null,
          detail: `Waiting for Docker to start, ${seconds} s`,
        });
        if (await deps.ping()) return OK;
      }
      return fail(
        'Docker did not start within 2 and a half minutes. Open Docker Desktop yourself and check whether it is showing a message.',
      );
    },
  };
}
