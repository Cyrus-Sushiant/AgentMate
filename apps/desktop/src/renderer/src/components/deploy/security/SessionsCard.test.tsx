import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogHost } from '@/components/ConfirmDialog';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { SERVER, TABLET_SESSION, THIS_SESSION } from './testing/fixtures';

/**
 * The signed-in user's own sessions on a core, this one marked. Ending one signs that computer
 * out; ending all the others at once takes the server's name typed out.
 */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { SessionsCard } = await import('./SessionsCard');

function renderCard(bridge: Record<string, unknown> = {}) {
  return renderWithProviders(
    <>
      <SessionsCard server={SERVER} />
      <ConfirmDialogHost />
    </>,
    {
      bridge: {
        'deploySecurity.listSessions': async () => [THIS_SESSION, TABLET_SESSION],
        'deploySecurity.revokeSession': async () => undefined,
        'deploySecurity.revokeOtherSessions': async () => 1,
        ...bridge,
      },
    },
  );
}

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
});

describe('SessionsCard', () => {
  it('shimmers while the sessions load', () => {
    const { container } = renderCard({
      'deploySecurity.listSessions': () => new Promise(() => undefined),
    });

    expect(container.querySelector('[aria-busy="true"] .shimmer')).not.toBeNull();
  });

  it('says why they could not be read, and asks again on request', async () => {
    let calls = 0;
    const { user } = renderCard({
      'deploySecurity.listSessions': async () => {
        calls += 1;
        if (calls === 1) throw new Error('The core did not answer in time.');
        return [THIS_SESSION];
      },
    });

    expect(await screen.findByText('The core did not answer in time.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Try again/ }));

    expect(await screen.findByRole('listitem', { name: 'Maria-PC' })).toBeTruthy();
  });

  it('marks this session and says when each began, was last active and ends', async () => {
    renderCard();

    const mine = within(await screen.findByRole('listitem', { name: 'Maria-PC' }));
    expect(mine.getByText('This session')).toBeTruthy();
    expect(mine.getByText(/Signed in 2h ago · Active 1m ago · Ends in \d+d/)).toBeTruthy();
    expect(mine.queryByRole('button', { name: /End/ })).toBeNull();
    expect(
      within(screen.getByRole('listitem', { name: 'maria-tablet' })).getByRole('button', {
        name: 'End the session on maria-tablet',
      }),
    ).toBeTruthy();
  });

  it('offers nothing to end when this is the only session', async () => {
    renderCard({ 'deploySecurity.listSessions': async () => [THIS_SESSION] });

    await screen.findByRole('listitem', { name: 'Maria-PC' });

    expect(screen.queryByRole('button', { name: /End all other sessions/ })).toBeNull();
  });

  it('ends one session after confirming', async () => {
    const { user, bridge } = renderCard();

    await user.click(
      await screen.findByRole('button', { name: 'End the session on maria-tablet' }),
    );
    const confirm = await screen.findByRole('dialog', { name: 'End the session on maria-tablet?' });
    await user.click(within(confirm).getByRole('button', { name: 'End the session' }));

    await waitFor(() =>
      expect(bridge.$fn('deploySecurity.revokeSession')).toHaveBeenCalledWith(
        'srv-1',
        TABLET_SESSION.id,
      ),
    );
    expect(toast.success).toHaveBeenCalledWith('maria-tablet is signed out.');
  });

  it("ends every other session once the server's name is typed out", async () => {
    const { user, bridge } = renderCard();

    await user.click(await screen.findByRole('button', { name: /End all other sessions/ }));
    const confirm = await screen.findByRole('dialog', { name: 'End all your other sessions?' });
    const end = within(confirm).getByRole('button', { name: 'End them' });
    expect((end as HTMLButtonElement).disabled).toBe(true);
    await user.type(within(confirm).getByLabelText('Type Production to confirm'), 'Production');
    await user.click(end);

    await waitFor(() =>
      expect(bridge.$fn('deploySecurity.revokeOtherSessions')).toHaveBeenCalledWith('srv-1'),
    );
    expect(toast.success).toHaveBeenCalledWith('Ended 1 other session.');
  });

  it('counts more than one in the plural', async () => {
    const { user } = renderCard({ 'deploySecurity.revokeOtherSessions': async () => 3 });

    await user.click(await screen.findByRole('button', { name: /End all other sessions/ }));
    await user.type(await screen.findByLabelText('Type Production to confirm'), 'Production');
    await user.click(screen.getByRole('button', { name: 'End them' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Ended 3 other sessions.'));
  });

  it("passes on the core's refusal", async () => {
    const { user } = renderCard({
      'deploySecurity.revokeSession': async () => {
        throw new Error(
          "Error invoking remote method 'deploySecurity:revokeSession': Error: There is no such session.",
        );
      },
    });

    await user.click(
      await screen.findByRole('button', { name: 'End the session on maria-tablet' }),
    );
    await user.click(await screen.findByRole('button', { name: 'End the session' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('There is no such session.'));
  });
});
