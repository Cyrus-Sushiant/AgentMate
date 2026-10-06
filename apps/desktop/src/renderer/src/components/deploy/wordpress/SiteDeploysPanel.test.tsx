import type { DeployWordPressDeployResult } from '@shared/deployWordPressTypes';
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogHost } from '@/components/ConfirmDialog';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { SiteDeploysPanel } from './SiteDeploysPanel';
import { wpRecord, wpSite } from './testing/fixtures';

/**
 * Deploy history: what became of each deploy in plain words (a rollback with its reason), and a
 * manual rollback behind a confirmation, with its progress while it runs.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
);
vi.mock('sonner', () => ({ toast }));

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
});

const RESULT: DeployWordPressDeployResult = {
  deployId: 'dep-1',
  state: 'rolledBack',
  reason: 'requested',
  health: [],
  uploaded: 0,
  deleted: 0,
  durationMs: 900,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderPanel(bridge: Record<string, unknown> = {}, site = wpSite()) {
  return renderWithProviders(
    <>
      <SiteDeploysPanel site={site} />
      <ConfirmDialogHost />
    </>,
    {
      bridge: {
        'deployWordPress.history': async () => [
          wpRecord(),
          wpRecord({
            deployId: 'dep-0',
            label: 'Broken footer',
            state: 'rolledBack',
            reason: 'fatalError',
            canRollback: false,
          }),
          wpRecord({ deployId: 'dep-old', label: 'Old one', canRollback: false }),
        ],
        ...bridge,
      },
    },
  );
}

describe('SiteDeploysPanel', () => {
  it('shimmers while the history loads', () => {
    const { container } = renderPanel({
      'deployWordPress.history': () => new Promise(() => undefined),
    });

    expect(container.querySelector('[aria-busy="true"] .shimmer')).not.toBeNull();
  });

  it('says what became of each deploy, with the rollback reason in words', async () => {
    renderPanel();

    const list = await screen.findByRole('list', { name: 'Deploys' });
    expect(within(list).getByText('Header tweaks')).toBeTruthy();
    expect(within(list).getAllByText(/3 files written, 1 file deleted/)).toHaveLength(3);
    expect(within(list).getByText(/A changed file caused a PHP fatal error/)).toBeTruthy();
  });

  it('keeps Roll back off once the snapshot is gone, and says why', async () => {
    const { user } = renderPanel();

    const button = (await screen.findByRole('button', {
      name: 'Roll back Old one',
    })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await user.hover(button.parentElement as HTMLElement);
    expect(await screen.findByRole('tooltip', { name: /its snapshot is gone/ })).toBeTruthy();
  });

  it('rolls back after a confirmation and shows progress while it runs', async () => {
    const call = deferred<DeployWordPressDeployResult>();
    const { user, bridge } = renderPanel({ 'deployWordPress.rollback': () => call.promise });

    await user.click(await screen.findByRole('button', { name: 'Roll back Header tweaks' }));
    expect(await screen.findByText('Roll back this deploy?')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Roll back' }));

    await waitFor(() => expect(bridge.$fn('deployWordPress.rollback')).toHaveBeenCalled());
    const input = bridge.$fn('deployWordPress.rollback').mock.calls[0][0] as {
      operationId: string;
    };
    expect(input).toMatchObject({ siteId: wpSite().id, deployId: 'dep-1' });
    expect(input).not.toHaveProperty('force');

    bridge.$emit('deployWordPress.onProgress', {
      operationId: input.operationId,
      siteId: wpSite().id,
      projectId: null,
      kind: 'rollback',
      phase: 'rollback',
      done: 2,
      total: 4,
    });
    expect(await screen.findByText('Putting the old files back (2 of 4)')).toBeTruthy();

    call.resolve(RESULT);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Rolled back. The files are as they were before that deploy.',
      ),
    );
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const { user, bridge } = renderPanel({ 'deployWordPress.rollback': async () => RESULT });

    await user.click(await screen.findByRole('button', { name: 'Roll back Header tweaks' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(() => bridge.$fn('deployWordPress.rollback')).toThrow();
  });

  it('asks again before forcing a rollback over later changes on the site', async () => {
    let calls = 0;
    const { user, bridge } = renderPanel({
      'deployWordPress.rollback': async () => {
        calls += 1;
        if (calls === 1) throw new Error('[wp:conflict] changed since');
        return RESULT;
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Roll back Header tweaks' }));
    await user.click(screen.getByRole('button', { name: 'Roll back' }));
    expect(await screen.findByText('Files changed since this deploy')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Roll back anyway' }));

    await waitFor(() =>
      expect(bridge.$fn('deployWordPress.rollback')).toHaveBeenLastCalledWith(
        expect.objectContaining({ deployId: 'dep-1', force: true }),
      ),
    );
  });

  it('keeps rollback off for a read-only key', async () => {
    renderPanel({}, wpSite({ scope: 'read' }));

    const button = (await screen.findByRole('button', {
      name: 'Roll back Header tweaks',
    })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('says why the history did not load', async () => {
    renderPanel({
      'deployWordPress.history': async () => {
        throw new Error('[wp:unreachable] ECONNREFUSED');
      },
    });

    expect(await screen.findByText(/Couldn't reach the site/)).toBeTruthy();
  });
});
