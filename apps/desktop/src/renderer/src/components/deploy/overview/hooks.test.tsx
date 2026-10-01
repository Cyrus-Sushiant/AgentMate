import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderHookWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { useConnectionUpdates, useJobLog, useLiveAlerts, useLiveSamples } from './hooks';
import { connection, metricsSample, SERVER, sampleAlert, sampleJob } from './testing/fixtures';

/** The Overview's live feeds: what they keep, what they ignore, and how they recover. */

describe('useLiveAlerts', () => {
  it('keeps the highest revision of each alert, drops resolved ones and sorts by severity', async () => {
    const { result, bridge } = renderHookWithProviders(() => useLiveAlerts(SERVER.id, true), {
      bridge: {
        'deployAlerts.list': [sampleAlert({ id: 1, revision: 3 })],
        'deployAlerts.watch': async () => 'alerts-1',
      },
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await waitFor(() => expect(bridge.$listenerCount('deployAlerts.onChanged')).toBe(1));
    act(() =>
      bridge.$emit('deployAlerts.onChanged', {
        subscriptionId: 'alerts-1',
        serverId: SERVER.id,
        alerts: [
          sampleAlert({ id: 1, revision: 2, message: 'older' }),
          sampleAlert({ id: 2, revision: 1, severity: 'critical', message: 'disk' }),
          sampleAlert({
            id: 3,
            revision: 1,
            severity: 'info',
            message: 'gone',
            resolvedAtUnixMs: 5,
          }),
        ],
      }),
    );
    await waitFor(() => expect(result.current.open.map((alert) => alert.id)).toEqual([2, 1]));
    expect(result.current.open[1].message).not.toBe('older');
    act(() => result.current.merge(sampleAlert({ id: 2, revision: 2, resolvedAtUnixMs: 9 })));
    expect(result.current.open.map((alert) => alert.id)).toEqual([1]);
  });

  it('orders alerts of one severity newest first, and does nothing while off', async () => {
    const { result } = renderHookWithProviders(() => useLiveAlerts(SERVER.id, true), {
      bridge: {
        'deployAlerts.list': [
          sampleAlert({ id: 1, lastSeenAtUnixMs: 1 }),
          sampleAlert({ id: 2, lastSeenAtUnixMs: 2 }),
        ],
        'deployAlerts.watch': async () => 'alerts-1',
      },
    });
    await waitFor(() => expect(result.current.open.map((alert) => alert.id)).toEqual([2, 1]));
    const off = renderHookWithProviders(() => useLiveAlerts(SERVER.id, false));
    expect(off.result.current.ready).toBe(false);
  });
});

describe('useLiveSamples', () => {
  it('starts the stream without a cursor when the stored history fails', async () => {
    const { result, bridge } = renderHookWithProviders(() => useLiveSamples(SERVER.id, true), {
      bridge: {
        'deploy.connection': connection('online'),
        'deploySystem.metricsHistory': () => Promise.reject(new Error('no history')),
        'deploySystem.watchMetrics': async () => 'm-1',
      },
    });
    await waitFor(() => expect(bridge.$listenerCount('deploySystem.onMetrics')).toBe(1));
    await waitFor(() =>
      expect(bridge.$fn('deploySystem.watchMetrics')).toHaveBeenCalledWith({
        serverId: SERVER.id,
        intervalMs: 2_000,
      }),
    );
    act(() =>
      bridge.$emit('deploySystem.onMetrics', {
        subscriptionId: 'm-1',
        serverId: SERVER.id,
        samples: [metricsSample(1_000)],
      }),
    );
    expect(result.current.samples).toHaveLength(1);
    expect(result.current.ready).toBe(true);
  });

  it('tries the stream again once the connection is back', async () => {
    const watch = vi
      .fn()
      .mockRejectedValueOnce(new Error('[core:x] down'))
      .mockResolvedValue('m-2');
    const hook = () => {
      useConnectionUpdates();
      return useLiveSamples(SERVER.id, true);
    };
    const { result, bridge } = renderHookWithProviders(hook, {
      bridge: {
        'deploy.connection': connection('reconnecting'),
        'deploySystem.metricsHistory': { resolution: 'live', intervalSeconds: 2, samples: [] },
        'deploySystem.watchMetrics': watch,
      },
    });
    await waitFor(() => expect(result.current.error).toBe('down'));
    act(() => bridge.$emit('deploy.onConnection', connection('online')));
    await waitFor(() => expect(watch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});

describe('useJobLog', () => {
  it('adds only new lines, follows the job and notes why a log ended', async () => {
    const job = sampleJob();
    const { result, bridge } = renderHookWithProviders(() => useJobLog(SERVER.id, job), {
      bridge: { 'deployJobs.watch': async () => 'l-1' },
    });
    await waitFor(() => expect(bridge.$listenerCount('deployJobs.onLog')).toBe(1));
    const line = (seq: number) => ({
      seq,
      atUnixMs: seq,
      source: 'out' as const,
      text: `line ${seq}`,
    });
    const emit = (event: object) =>
      act(() =>
        bridge.$emit('deployJobs.onLog', {
          subscriptionId: 'l-1',
          serverId: SERVER.id,
          jobId: job.id,
          lines: [],
          ...event,
        }),
      );
    emit({ lines: [line(1), line(2)] });
    emit({ lines: [line(2), line(3)] });
    expect(result.current.lines.map((l) => l.seq)).toEqual([1, 2, 3]);
    emit({ ended: { error: 'Viewers cannot see this log.' } });
    expect(result.current.ended).toBe(true);
    expect(result.current.error).toBe('Viewers cannot see this log.');
    expect(result.current.job).toBe(job);
  });

  it('says so when the log cannot be watched, and waits for a job', async () => {
    const { result } = renderHookWithProviders(() => useJobLog(SERVER.id, sampleJob()), {
      bridge: { 'deployJobs.watch': () => Promise.reject(new Error('gone')) },
    });
    await waitFor(() => expect(result.current.error).toBe('gone'));
    const none = renderHookWithProviders(() => useJobLog(SERVER.id, null));
    expect(none.result.current.ended).toBe(false);
  });
});
