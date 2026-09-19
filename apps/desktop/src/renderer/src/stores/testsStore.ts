import type { TestResult, TestRunEvent, TestRunSnapshot, TestRunSummary } from '@agentmat/core';
import { create } from 'zustand';

/**
 * The Tests panel's view of each project's latest run, fed by the events main broadcasts. Not
 * persisted: main keeps the last run, and the panel hydrates from it when it opens.
 */

const MAX_OUTPUT_CHARS = 200_000;

export interface ProjectTestRun {
  summary: TestRunSummary | null;
  results: Record<string, TestResult>;
  output: string;
  /** What queued tests showed before this run, so a cancel can put it back. */
  previous?: Record<string, TestResult>;
}

export function applyRunEvent(
  run: ProjectTestRun | undefined,
  event: TestRunEvent,
): ProjectTestRun {
  const current: ProjectTestRun = run ?? { summary: null, results: {}, output: '' };
  if (event.type === 'started') {
    const results = { ...current.results };
    const previous: Record<string, TestResult> = {};
    for (const id of event.queued) {
      const old = results[id];
      if (old) previous[id] = old;
      results[id] = old
        ? { ...old, status: 'queued', message: undefined, stack: undefined, durationMs: undefined }
        : { id, testProjectId: id.split('::')[0], path: [], status: 'queued' };
    }
    return { summary: event.summary, results, output: '', previous };
  }
  if (current.summary?.runId !== event.runId) return current;
  switch (event.type) {
    case 'output':
      return { ...current, output: (current.output + event.text).slice(-MAX_OUTPUT_CHARS) };
    case 'results': {
      const results = { ...current.results };
      for (const result of event.results) results[result.id] = result;
      return { ...current, results };
    }
    case 'done': {
      const results = { ...current.results };
      for (const [id, result] of Object.entries(results)) {
        if (result.status !== 'queued' && result.status !== 'running') continue;
        const before = current.previous?.[id];
        if (before) results[id] = before;
        else delete results[id];
      }
      return { summary: event.summary, results, output: current.output };
    }
  }
}

export function failedResults(run: ProjectTestRun | undefined): TestResult[] {
  return run ? Object.values(run.results).filter((result) => result.status === 'failed') : [];
}

/**
 * Folds neighbouring output and results events of one run into a single event, so a burst of
 * them costs one copy of the results map instead of one per event.
 */
export function coalesceEvents(events: TestRunEvent[]): TestRunEvent[] {
  const out: TestRunEvent[] = [];
  for (const event of events) {
    const last = out[out.length - 1];
    if (last && last.type === 'output' && event.type === 'output' && last.runId === event.runId) {
      out[out.length - 1] = { ...last, text: last.text + event.text };
    } else if (
      last &&
      last.type === 'results' &&
      event.type === 'results' &&
      last.runId === event.runId
    ) {
      out[out.length - 1] = { ...last, results: [...last.results, ...event.results] };
    } else {
      out.push(event);
    }
  }
  return out;
}

interface TestsState {
  runs: Record<string, ProjectTestRun>;
  applyEvent: (event: TestRunEvent) => void;
  applyEvents: (events: TestRunEvent[]) => void;
  hydrate: (projectId: string, snapshot: TestRunSnapshot) => void;
}

export const useTestsStore = create<TestsState>((set) => ({
  runs: {},
  applyEvent: (event) =>
    set((state) => ({
      runs: { ...state.runs, [event.projectId]: applyRunEvent(state.runs[event.projectId], event) },
    })),
  applyEvents: (events) =>
    set((state) => {
      const runs = { ...state.runs };
      for (const event of coalesceEvents(events)) {
        runs[event.projectId] = applyRunEvent(runs[event.projectId], event);
      }
      return { runs };
    }),
  hydrate: (projectId, snapshot) =>
    set((state) => {
      const live = state.runs[projectId]?.summary;
      if (
        live &&
        (live.running || live.startedAt >= snapshot.summary.startedAt) &&
        live.runId !== snapshot.summary.runId
      ) {
        return state;
      }
      return {
        runs: {
          ...state.runs,
          [projectId]: {
            summary: snapshot.summary,
            results: Object.fromEntries(snapshot.results.map((result) => [result.id, result])),
            output: snapshot.output,
          },
        },
      };
    }),
}));

let subscribed = false;

/** How long events are held before they reach the store; a large run sends them by the hundred. */
const EVENT_FLUSH_MS = 150;
let queued: TestRunEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushEvents(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queued.length === 0) return;
  const batch = queued;
  queued = [];
  useTestsStore.getState().applyEvents(batch);
}

function queueEvent(event: TestRunEvent): void {
  queued.push(event);
  // Start and end land at once so the buttons and counts never lag behind the run.
  if (event.type === 'started' || event.type === 'done') {
    flushEvents();
    return;
  }
  if (!flushTimer) flushTimer = setTimeout(flushEvents, EVENT_FLUSH_MS);
}

/** Starts listening for run events once for the whole window. */
export function ensureTestRunSubscription(): void {
  if (subscribed || !window.agentmat?.tests) return;
  subscribed = true;
  window.agentmat.tests.onRunEvent(queueEvent);
}
