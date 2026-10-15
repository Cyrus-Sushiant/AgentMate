import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { RunProposalHost } from './RunProposalHost';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

const PROPOSED =
  'Push-Location E:\\BitIron\\BitIronPlatform\\app; flutter run --flavor dev -d emulator-5554; Pop-Location';

const apollo = {
  id: 'r1',
  projectId: 'p1',
  projectName: 'Apollo',
  label: 'android dev',
  command: PROPOSED,
  proposedAt: '2026-10-16T10:00:00.000Z',
};
const second = { ...apollo, id: 'r2', label: '', command: 'npm run serve' };

type Changed = { pending: unknown[] };

/** Renders the host with the suggestions it starts with, and lets a test announce a new list. */
function renderHost(pending: unknown[], decideResult: unknown = { ok: true, projectId: 'p1' }) {
  const listeners: ((changed: Changed) => void)[] = [];
  const view = renderWithProviders(<RunProposalHost />, {
    bridge: {
      'runProposals.list': async () => pending,
      'runProposals.onChanged': (callback: (changed: Changed) => void) => {
        listeners.push(callback);
        return () => undefined;
      },
      'runProposals.decide': async () => decideResult,
    },
  });
  const announce = (next: unknown[]) =>
    act(() => {
      for (const listener of listeners) listener({ pending: next });
    });
  return { ...view, announce };
}

describe('RunProposalHost', () => {
  it('shows nothing while no suggestion is waiting', async () => {
    const { bridge } = renderHost([]);

    await waitFor(() => expect(bridge.$fn('runProposals.list')).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the suggestion with its project, and the command exactly as it was proposed', async () => {
    renderHost([apollo]);

    const dialog = await screen.findByRole('dialog', { name: 'Add "android dev" to Apollo?' });
    expect(within(dialog).getByText(PROPOSED)).toBeTruthy();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Discard' })).toHaveFocus(),
    );
  });

  it('adds the command when the user chooses Add command', async () => {
    const { user, bridge } = renderHost([apollo]);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Add command' }));

    expect(bridge.$fn('runProposals.decide')).toHaveBeenCalledWith('r1', 'add');
  });

  it('discards the suggestion on Discard', async () => {
    const { user, bridge } = renderHost([apollo]);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

    expect(bridge.$fn('runProposals.decide')).toHaveBeenCalledWith('r1', 'discard');
  });

  it('treats Escape as Discard, so a dismissed suggestion is never left waiting', async () => {
    const { user, bridge } = renderHost([apollo]);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(bridge.$fn('runProposals.decide')).toHaveBeenCalledWith('r1', 'discard');
  });

  it('shows one suggestion at a time, says how many are waiting, and moves on after a decision', async () => {
    const { user, announce } = renderHost([apollo, second]);
    expect(await screen.findByText('1 of 2 suggestions')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add command' }));

    expect(
      await screen.findByRole('dialog', { name: 'Add a run command to Apollo?' }),
    ).toBeTruthy();
    announce([]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('says why when AgentMate will not add it, and takes the suggestion off the screen', async () => {
    const { user } = renderHost([apollo], {
      ok: false,
      error: 'This project already has that run command.',
    });
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Add command' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('This project already has that run command.'),
    );
  });
});
