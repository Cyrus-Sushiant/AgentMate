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

interface TestsState {
  runs: Record<string, ProjectTestRun>;
  applyEvent: (event: TestRunEvent) => void;
  hydrate: (projectId: string, snapshot: TestRunSnapshot) => void;
}

export const useTestsStore = create<TestsState>((set) => ({
  runs: {},
  applyEvent: (event) =>
    set((state) => ({
      runs: { ...state.runs, [event.projectId]: applyRunEvent(state.runs[event.projectId], event) },
    })),
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

/** Starts listening for run events once for the whole window. */
export function ensureTestRunSubscription(): void {
  if (subscribed || !window.agentmat?.tests) return;
  subscribed = true;
  window.agentmat.tests.onRunEvent((event) => useTestsStore.getState().applyEvent(event));
}
