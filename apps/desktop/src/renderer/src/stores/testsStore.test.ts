import type { TestResult, TestRunEvent, TestRunSummary } from '@agentmat/core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyRunEvent,
  coalesceEvents,
  failedResults,
  type ProjectTestRun,
  useTestsStore,
} from './testsStore';

const summary = (patch: Partial<TestRunSummary> = {}): TestRunSummary => ({
  runId: 'r1',
  projectId: 'p1',
  startedAt: 1,
  running: true,
  cancelled: false,
  passed: 0,
  failed: 0,
  skipped: 0,
  commands: [],
  errors: [],
  ...patch,
});

const result = (id: string, status: TestResult['status'], path = [id]): TestResult => ({
  id,
  testProjectId: 'vitest:',
  file: 'a.test.ts',
  path,
  status,
});

describe('applyRunEvent', () => {
  it('queues picked tests on start, keeps older results for the rest and clears the output', () => {
    const before: ProjectTestRun = {
      summary: summary({ runId: 'r0', running: false }),
      results: { a: result('a', 'failed'), b: result('b', 'passed') },
      output: 'old output',
    };
    const next = applyRunEvent(before, {
      type: 'started',
      runId: 'r1',
      projectId: 'p1',
      summary: summary(),
      queued: ['a'],
    });
    expect(next.summary?.runId).toBe('r1');
    expect(next.results.a.status).toBe('queued');
    expect(next.results.b.status).toBe('passed');
    expect(next.output).toBe('');
  });

  it('appends output and results, and caps the output', () => {
    let run = applyRunEvent(undefined, {
      type: 'started',
      runId: 'r1',
      projectId: 'p1',
      summary: summary(),
      queued: [],
    });
    run = applyRunEvent(run, { type: 'output', runId: 'r1', projectId: 'p1', text: 'line 1\n' });
    run = applyRunEvent(run, {
      type: 'output',
      runId: 'r1',
      projectId: 'p1',
      text: 'x'.repeat(300_000),
    });
    expect(run.output.length).toBeLessThanOrEqual(200_000);
    run = applyRunEvent(run, {
      type: 'results',
      runId: 'r1',
      projectId: 'p1',
      results: [result('a', 'failed')],
    });
    expect(run.results.a.status).toBe('failed');
  });

  it('ignores events from an older run', () => {
    const run = applyRunEvent(undefined, {
      type: 'started',
      runId: 'r2',
      projectId: 'p1',
      summary: summary({ runId: 'r2' }),
      queued: [],
    });
    const stale: TestRunEvent = {
      type: 'results',
      runId: 'r1',
      projectId: 'p1',
      results: [result('a', 'passed')],
    };
    expect(applyRunEvent(run, stale)).toBe(run);
  });

  it('drops tests still queued when the run ends, and brings back what they showed before', () => {
    let run: ProjectTestRun = {
      summary: summary({ runId: 'r0', running: false }),
      results: { a: result('a', 'failed'), c: result('c', 'passed') },
      output: '',
    };
    run = applyRunEvent(run, {
      type: 'started',
      runId: 'r1',
      projectId: 'p1',
      summary: summary(),
      queued: ['a', 'b', 'c'],
    });
    run = applyRunEvent(run, {
      type: 'results',
      runId: 'r1',
      projectId: 'p1',
      results: [result('c', 'failed')],
    });
    run = applyRunEvent(run, {
      type: 'done',
      runId: 'r1',
      projectId: 'p1',
      summary: summary({ running: false, cancelled: true }),
    });
    expect(run.summary?.running).toBe(false);
    expect(run.results.a.status).toBe('failed');
    expect(run.results.b).toBeUndefined();
    expect(run.results.c.status).toBe('failed');
  });
});

describe('useTestsStore', () => {
  beforeEach(() => useTestsStore.setState({ runs: {} }));

  it('routes events to their project and hydrates a snapshot', () => {
    const store = useTestsStore.getState();
    store.hydrate('p2', {
      summary: summary({ projectId: 'p2', running: false, failed: 1 }),
      results: [result('x', 'failed')],
      output: 'o',
      queued: [],
    });
    store.applyEvent({
      type: 'started',
      runId: 'r9',
      projectId: 'p1',
      summary: summary({ runId: 'r9' }),
      queued: [],
    });
    const { runs } = useTestsStore.getState();
    expect(runs.p2.results.x.status).toBe('failed');
    expect(runs.p1.summary?.runId).toBe('r9');
    expect(failedResults(runs.p2).map((entry) => entry.id)).toEqual(['x']);
  });

  it('does not let a stale snapshot overwrite a run that is already live', () => {
    const store = useTestsStore.getState();
    store.applyEvent({
      type: 'started',
      runId: 'r9',
      projectId: 'p1',
      summary: summary({ runId: 'r9' }),
      queued: [],
    });
    store.hydrate('p1', {
      summary: summary({ runId: 'r8', running: false }),
      results: [],
      output: '',
      queued: [],
    });
    expect(useTestsStore.getState().runs.p1.summary?.runId).toBe('r9');
  });

  it('keeps the tests that are still waiting when a live run is hydrated again', () => {
    const store = useTestsStore.getState();
    store.applyEvent({
      type: 'started',
      runId: 'r1',
      projectId: 'p1',
      summary: summary(),
      queued: ['a', 'b'],
    });
    // The panel closed and opened again mid-run: main only knows about the results so far.
    store.hydrate('p1', {
      summary: summary(),
      results: [result('a', 'passed')],
      output: 'o',
      queued: ['a', 'b'],
    });
    const run = useTestsStore.getState().runs.p1;
    expect(run.results.a.status).toBe('passed');
    expect(run.results.b.status).toBe('queued');
    expect(run.output).toBe('o');
  });

  it('keeps what a waiting test showed before, so a cancel after hydrating puts it back', () => {
    const store = useTestsStore.getState();
    store.hydrate('p1', {
      summary: summary({ runId: 'r0', running: false }),
      results: [result('b', 'failed')],
      output: '',
      queued: [],
    });
    store.applyEvent({
      type: 'started',
      runId: 'r1',
      projectId: 'p1',
      summary: summary(),
      queued: ['a', 'b'],
    });
    store.hydrate('p1', { summary: summary(), results: [], output: '', queued: ['a', 'b'] });
    store.applyEvent({
      type: 'done',
      runId: 'r1',
      projectId: 'p1',
      summary: summary({ running: false, cancelled: true }),
    });
    const run = useTestsStore.getState().runs.p1;
    expect(run.results.a).toBeUndefined();
    expect(run.results.b.status).toBe('failed');
  });

  it('leaves a finished run alone, queued ids and all', () => {
    const store = useTestsStore.getState();
    store.hydrate('p1', {
      summary: summary({ running: false, passed: 1 }),
      results: [result('a', 'passed')],
      output: '',
      queued: ['a', 'b'],
    });
    const run = useTestsStore.getState().runs.p1;
    expect(run.results.b).toBeUndefined();
    expect(Object.keys(run.results)).toEqual(['a']);
  });
});

describe('coalesceEvents', () => {
  const result = (id: string) => ({
    id,
    testProjectId: 'p',
    path: [id],
    status: 'passed' as const,
  });

  it('folds neighbouring results and output of one run into single events', () => {
    const events = coalesceEvents([
      { type: 'results', runId: 'r', projectId: 'a', results: [result('1')] },
      { type: 'results', runId: 'r', projectId: 'a', results: [result('2')] },
      { type: 'output', runId: 'r', projectId: 'a', text: 'x' },
      { type: 'output', runId: 'r', projectId: 'a', text: 'y' },
    ]);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'results' });
    expect((events[0] as { results: unknown[] }).results).toHaveLength(2);
    expect(events[1]).toMatchObject({ type: 'output', text: 'xy' });
  });
});
