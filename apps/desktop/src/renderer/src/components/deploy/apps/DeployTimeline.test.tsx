import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { DeployTimeline } from './DeployTimeline';
import { appsBridge, JOB_ID, SERVER, sampleJob, sampleRevision } from './testing/fixtures';

/** The deploy timeline: steps with their own logs and durations, in every way a deploy ends. */

function line(seq: number, text: string, source: 'out' | 'err' | 'system' = 'out') {
  return { seq, atUnixMs: Date.now(), source, text };
}

function renderTimeline(
  revision: ReturnType<typeof sampleRevision>,
  options: { bridge?: Record<string, unknown>; onRollback?: () => void; canOperate?: boolean } = {},
) {
  const onSettled = vi.fn();
  const view = renderWithProviders(
    <DeployTimeline
      serverId={SERVER.id}
      revision={revision}
      canOperate={options.canOperate ?? true}
      onSettled={onSettled}
      onRollback={options.onRollback}
    />,
    { bridge: { ...appsBridge(), ...options.bridge } },
  );
  return { ...view, onSettled };
}

const now = Date.now();

describe('DeployTimeline', () => {
  it('follows a running deploy: the running step opens with its live lines, its time ticks', async () => {
    const { bridge, user, onSettled } = renderTimeline(
      sampleRevision({
        number: 3,
        state: 'deploying',
        steps: [
          {
            kind: 'validate',
            state: 'succeeded',
            startedAtUnixMs: now - 4_000,
            finishedAtUnixMs: now - 3_500,
            firstLogSeq: 2,
            lastLogSeq: 2,
          },
          { kind: 'pull', state: 'running', startedAtUnixMs: now - 3_500, firstLogSeq: 3 },
        ],
      }),
      { bridge: { 'deployJobs.cancel': async () => undefined } },
    );
    const steps = screen.getByRole('list', { name: 'Deploy steps' });
    expect(
      within(steps)
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual(['Validate', 'Pull images', 'Build', 'Start containers', 'Health check']);
    expect(within(steps).getByRole('listitem', { name: 'Build' })).toHaveTextContent('Waiting');
    await waitFor(() => expect(bridge.$listenerCount('deployJobs.onLog')).toBe(1));
    act(() =>
      bridge.$emit('deployJobs.onLog', {
        subscriptionId: 'log-1',
        serverId: SERVER.id,
        jobId: JOB_ID,
        lines: [
          line(1, 'Deploy shop: started.', 'system'),
          line(2, 'name: shop'),
          line(3, 'Pulling web'),
          line(4, '<b>not markup</b>', 'err'),
        ],
      }),
    );
    const log = await screen.findByRole('log', { name: 'Pull images log' });
    expect(log).toHaveTextContent('Pulling web');
    expect(log).toHaveTextContent('<b>not markup</b>');
    expect(log.querySelector('b')).toBeNull();
    expect(log).not.toHaveTextContent('name: shop');
    expect(screen.queryByRole('log', { name: 'Validate log' })).toBeNull();

    await user.click(within(steps).getByRole('button', { name: /Validate/ }));
    expect(screen.getByRole('log', { name: 'Validate log' })).toHaveTextContent('name: shop');

    await user.click(screen.getByRole('button', { name: 'Cancel the deploy' }));
    expect(bridge.$fn('deployJobs.cancel')).toHaveBeenCalledWith(SERVER.id, JOB_ID);

    act(() =>
      bridge.$emit('deployJobs.onLog', {
        subscriptionId: 'log-1',
        serverId: SERVER.id,
        jobId: JOB_ID,
        lines: [],
        job: sampleJob({ state: 'cancelled' }),
        ended: {},
      }),
    );
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1));
  });

  it('says when a deploy succeeded, with each step done and how long it took', () => {
    renderTimeline(sampleRevision());
    expect(screen.getByRole('status')).toHaveTextContent('Revision 2 is live.');
    const steps = screen.getByRole('list', { name: 'Deploy steps' });
    expect(within(steps).getByRole('listitem', { name: 'Build' })).toHaveTextContent('Skipped');
    expect(within(steps).getByRole('listitem', { name: 'Pull images' })).toHaveTextContent('4.2 s');
    expect(screen.queryByRole('button', { name: 'Cancel the deploy' })).toBeNull();
  });

  it('says where a deploy failed and opens that step', async () => {
    renderTimeline(
      sampleRevision({
        number: 3,
        state: 'failed',
        steps: [
          {
            kind: 'validate',
            state: 'succeeded',
            startedAtUnixMs: now - 4_000,
            finishedAtUnixMs: now - 3_500,
          },
          {
            kind: 'pull',
            state: 'failed',
            startedAtUnixMs: now - 3_500,
            finishedAtUnixMs: now - 1_000,
            firstLogSeq: 3,
            lastLogSeq: 3,
            detail: 'manifest for shop:9 not found',
          },
        ],
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The deploy failed at pull images: manifest for shop:9 not found',
    );
    expect(screen.getByRole('log', { name: 'Pull images log' })).toHaveTextContent(
      'Nothing was written.',
    );
  });

  it('says when a deploy was cancelled', () => {
    renderTimeline(
      sampleRevision({
        number: 3,
        state: 'failed',
        steps: [
          {
            kind: 'validate',
            state: 'cancelled',
            startedAtUnixMs: now - 4_000,
            finishedAtUnixMs: now - 3_000,
          },
        ],
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('The deploy was cancelled.');
  });

  it('offers a rollback on an older revision, and marks a revision made by one', async () => {
    const onRollback = vi.fn();
    const { user } = renderTimeline(
      sampleRevision({ number: 1, state: 'superseded', rollbackOf: 0 }),
      { onRollback },
    );
    expect(screen.getByRole('status')).toHaveTextContent('a later one replaced it');
    expect(screen.getByText(/rollback of revision 0/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Roll back to this revision' }));
    expect(onRollback).toHaveBeenCalled();
  });

  it('says when a revision was never deployed, and when the log cannot be shown', async () => {
    const { bridge } = renderTimeline(
      sampleRevision({ number: 4, state: 'ready', steps: [], jobId: undefined }),
    );
    expect(screen.getByText('This revision has not been deployed yet.')).toBeInTheDocument();
    expect(() => bridge.$fn('deployJobs.watch')).toThrow();
  });

  it('shows why the log could not be followed and why a cancel failed', async () => {
    const { user } = renderTimeline(
      sampleRevision({
        number: 3,
        state: 'deploying',
        steps: [{ kind: 'validate', state: 'running', startedAtUnixMs: now }],
      }),
      {
        bridge: {
          'deployJobs.watch': () =>
            Promise.reject(new Error('This connection already has 4 job streams open.')),
          'deployJobs.cancel': () => Promise.reject(new Error('The job already finished.')),
        },
      },
    );
    expect(await screen.findByText(/already has 4 job streams open/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel the deploy' }));
    expect(await screen.findByText('The job already finished.')).toBeInTheDocument();
  });
});
