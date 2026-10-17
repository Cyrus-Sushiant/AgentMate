import {
  applyJobEvent,
  buildChecklist,
  buildInstallPlan,
  collectConsents,
  type DevDetection,
  type DevItem,
  type DevItemId,
  type DevJobEvent,
  type DevJobState,
  type DevSetupEnvironment,
  dependencyIds,
  displayName,
  EMPTY_JOB_STATE,
  getDevItem,
  type InstallMode,
  isDevItemId,
  itemsForStacks,
  meetsMinimum,
  normalizeDevSetupStacks,
  selectRecipe,
} from '@agentmat/core';
import type { CancelToken } from '../process/spawnStreaming';
import type { RunHooks, RunResult } from './runners/packageManagerRunner';

/**
 * Runs the installs the checklist asks for, one at a time, and reports what happens. The things it
 * is careful about are the ones that go wrong quietly: success is decided by looking again at the
 * machine rather than by an exit code, one failing step skips only what depends on it, and a
 * cancel really does stop the rest. The machine (processes, detection) is injected.
 */

/** What `install` throws when an agreement has not been accepted yet. */
export const CONSENT_REQUIRED = 'consent-required';

export interface InstallStep {
  item: DevItem;
  mode: Extract<InstallMode, { mode: 'in-app' }>;
}

export interface InstallerDeps {
  environment: () => Promise<DevSetupEnvironment>;
  /** The stacks the person switched on. */
  stacks: () => Promise<string[]>;
  detect: (id: DevItemId, options?: { force?: boolean }) => Promise<DevDetection>;
  /** Runs one in-app install and says how it went. */
  run: (step: InstallStep, hooks: RunHooks) => Promise<RunResult>;
  /** Picks up what the install changed: PATH, JAVA_HOME and the like. */
  afterInstall: () => Promise<void>;
  /** Marks the token cancelled and stops the process it belongs to. */
  cancelRun: (token: CancelToken) => void;
  emit: (event: DevJobEvent) => void;
  newJobId: () => string;
}

export interface InstallRequest {
  ids: readonly string[];
  /** The person accepted the agreements shown for the steps that carry one. */
  consented?: boolean;
}

export interface DevSetupInstaller {
  /** Plans the steps and starts them. Resolves once planned, not once finished. */
  install: (request: InstallRequest) => Promise<DevJobState>;
  /** With an id: take that waiting step out of the queue. Without: stop everything. */
  cancel: (id?: DevItemId) => void;
  jobState: () => DevJobState;
  /** Resolves when nothing is running. */
  whenIdle: () => Promise<void>;
  dispose: () => void;
}

function isInstalled(item: DevItem, detection: DevDetection): boolean {
  return detection.state === 'found' && meetsMinimum(detection.version, item.minVersion);
}

export function createDevSetupInstaller(deps: InstallerDeps): DevSetupInstaller {
  let state = EMPTY_JOB_STATE;
  const queue: DevItemId[] = [];
  let loop: Promise<void> | null = null;
  let cancelRequested = false;
  let currentToken: CancelToken | null = null;

  function dispatch(event: DevJobEvent): void {
    state = applyJobEvent(state, event);
    deps.emit(event);
  }

  async function runStep(jobId: string, id: DevItemId, failed: Set<DevItemId>): Promise<void> {
    const item = getDevItem(id);
    if (!item) return;
    const environment = await deps.environment();

    const before = await deps.detect(id, { force: true });
    if (isInstalled(item, before)) {
      dispatch({ type: 'finished', jobId, itemId: id, result: 'installed' });
      return;
    }

    const mode = selectRecipe(item, {
      ...environment,
      intent: before.state === 'found' ? 'update' : 'install',
    });
    // Something this step needs did not install, so running it would only fail in a confusing way.
    if (dependencyIds(item, environment.os, mode).some((dependency) => failed.has(dependency))) {
      failed.add(id);
      dispatch({ type: 'finished', jobId, itemId: id, result: 'cancelled' });
      return;
    }

    dispatch({ type: 'started', jobId, itemId: id });
    const name = displayName(item, environment.os);

    if (mode.mode !== 'in-app') {
      failed.add(id);
      dispatch({
        type: 'finished',
        jobId,
        itemId: id,
        result: 'failed',
        message: 'This one needs a terminal or a download. Use the buttons on its row.',
      });
      return;
    }

    const token: CancelToken = { cancelled: false, child: null };
    currentToken = token;
    let result: RunResult;
    try {
      result = await deps.run(
        { item, mode },
        {
          token,
          onProgress: (update) => dispatch({ type: 'progress', jobId, itemId: id, ...update }),
          onLine: (line) => dispatch({ type: 'log', jobId, itemId: id, line }),
        },
      );
    } catch (error) {
      result = {
        ok: false,
        code: null,
        cancelled: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    currentToken = null;

    if (result.cancelled || cancelRequested) {
      dispatch({ type: 'finished', jobId, itemId: id, result: 'cancelled' });
      return;
    }

    // The exit code is a hint. What counts is whether the tool can now be found.
    dispatch({ type: 'progress', jobId, itemId: id, phase: 'checking', fraction: null });
    await deps.afterInstall();
    const after = await deps.detect(id, { force: true });
    if (isInstalled(item, after)) {
      dispatch({
        type: 'finished',
        jobId,
        itemId: id,
        result: 'installed',
        restartAdvised: result.restartAdvised === true,
      });
      return;
    }

    failed.add(id);
    let message = result.message ?? 'The install did not finish.';
    if (result.ok) {
      message =
        after.state === 'found'
          ? `${name} is still version ${after.version ?? 'unknown'}. It needs ${item.minVersion ?? 'a newer version'} or newer.`
          : `The installer finished but ${name} was not found. Open a new terminal or restart AgentMate.`;
    }
    dispatch({
      type: 'finished',
      jobId,
      itemId: id,
      result: 'failed',
      message,
      exitCode: result.code,
    });
  }

  async function processQueue(jobId: string): Promise<void> {
    const failed = new Set<DevItemId>();
    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined) break;
      if (cancelRequested) {
        dispatch({ type: 'finished', jobId, itemId: id, result: 'cancelled' });
        continue;
      }
      await runStep(jobId, id, failed);
    }
    dispatch({ type: 'done', jobId, cancelled: cancelRequested });
    cancelRequested = false;
    loop = null;
  }

  function cancelAll(): void {
    if (!loop) return;
    cancelRequested = true;
    if (currentToken) deps.cancelRun(currentToken);
  }

  return {
    async install({ ids, consented }) {
      // Everything below is chosen from the catalog entry an id names, so an id that is not in it
      // stops here, whoever sent it.
      if (!Array.isArray(ids) || !ids.every(isDevItemId))
        throw new Error('Unknown dev setup item.');

      const [environment, savedStacks] = await Promise.all([deps.environment(), deps.stacks()]);
      // The request may name a tool from a stack that is switched off, so its stack is included.
      const stacks = normalizeDevSetupStacks([
        ...savedStacks,
        ...ids.map((id) => getDevItem(id)?.stack),
      ]);
      const items = itemsForStacks(stacks, environment.os);
      const detections = Object.fromEntries(
        await Promise.all(
          items.map(async (item) => [item.id, await deps.detect(item.id)] as const),
        ),
      );

      const checklist = buildChecklist({ stacks, environment, detections, jobs: state.items });
      // Steps already queued or running count as not needing work, so they are never planned twice.
      const steps = buildInstallPlan(ids, checklist.entries, environment.os).steps;
      if (steps.length === 0) return state;

      if (collectConsents(steps).length > 0 && consented !== true) {
        throw new Error(CONSENT_REQUIRED);
      }

      // Decided here, after the awaits, so a run that ended in the meantime is not appended to.
      const appending = loop !== null && state.running;
      const jobId = appending && state.jobId ? state.jobId : deps.newJobId();
      queue.push(...steps);
      dispatch({ type: 'plan', jobId, steps });
      if (!appending) loop = processQueue(jobId);
      return state;
    },
    cancel(id) {
      if (id !== undefined) {
        const index = queue.indexOf(id);
        if (index >= 0) {
          queue.splice(index, 1);
          dispatch({ type: 'finished', jobId: state.jobId ?? '', itemId: id, result: 'cancelled' });
          return;
        }
        if (state.current !== id) return;
      }
      cancelAll();
    },
    jobState: () => state,
    whenIdle: async () => {
      while (loop) await loop;
    },
    dispose: cancelAll,
  };
}
