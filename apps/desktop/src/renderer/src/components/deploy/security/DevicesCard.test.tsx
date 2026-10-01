import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogHost } from '@/components/ConfirmDialog';
import { queryKeys } from '@/lib/queryKeys';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { LAPTOP, OLD_DESKTOP, SERVER, THIS_COMPUTER } from './testing/fixtures';

/**
 * The computers enrolled on a core, with this one marked. Everyone sees their own; Admins and
 * Owners see everyone's. Revoking one ends its sessions, and revoking this one means enrolling
 * it again, which the confirmation says before it happens.
 */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { DevicesCard } = await import('./DevicesCard');

function renderCard(options: { everyone?: boolean; bridge?: Record<string, unknown> } = {}) {
  return renderWithProviders(
    <>
      <DevicesCard server={SERVER} everyone={options.everyone ?? true} />
      <ConfirmDialogHost />
    </>,
    {
      bridge: {
        'deploySecurity.listDevices': async () => [OLD_DESKTOP, THIS_COMPUTER, LAPTOP],
        'deploySecurity.revokeDevice': async () => undefined,
        ...options.bridge,
      },
    },
  );
}

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
});

describe('DevicesCard', () => {
  it('shimmers while the devices load', () => {
    const { container } = renderCard({
      bridge: { 'deploySecurity.listDevices': () => new Promise(() => undefined) },
    });

    expect(container.querySelector('[aria-busy="true"] .shimmer')).not.toBeNull();
  });

  it('says why the list could not be read, and asks again on request', async () => {
    let calls = 0;
    const { user } = renderCard({
      bridge: {
        'deploySecurity.listDevices': async () => {
          calls += 1;
          if (calls === 1) throw new Error('The core did not answer in time.');
          return [THIS_COMPUTER];
        },
      },
    });

    expect(await screen.findByText('The core did not answer in time.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Try again/ }));

    expect(await screen.findByRole('listitem', { name: 'Maria-PC' })).toBeTruthy();
  });

  it('says so when nothing is enrolled', async () => {
    renderCard({ bridge: { 'deploySecurity.listDevices': async () => [] } });

    expect(await screen.findByText('No computers are enrolled on this core.')).toBeTruthy();
  });

  it('marks this computer, names whose each one is, and lists revoked ones last', async () => {
    renderCard();

    const rows = await screen.findAllByRole('listitem');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'Maria-PC',
      'lee-laptop',
      'old-desktop',
    ]);
    const mine = within(rows[0]);
    expect(mine.getByText('This computer')).toBeTruthy();
    expect(mine.getByText(/maria · Enrolled 30d ago · Seen 1m ago/)).toBeTruthy();
    expect(mine.getByText('Active')).toBeTruthy();
    expect(within(rows[2]).getByText('Revoked')).toBeTruthy();
    expect(within(rows[2]).getByText(/Never seen/)).toBeTruthy();
    expect(within(rows[2]).queryByRole('button', { name: /Revoke/ })).toBeNull();
  });

  it("leaves out whose they are when the list is only the user's own", async () => {
    renderCard({ everyone: false });

    const mine = within(await screen.findByRole('listitem', { name: 'Maria-PC' }));
    expect(mine.getByText(/^Enrolled 30d ago/)).toBeTruthy();
  });

  it('revokes another computer after a destructive confirmation', async () => {
    const { user, bridge } = renderCard();

    await user.click(await screen.findByRole('button', { name: 'Revoke lee-laptop' }));
    const confirm = await screen.findByRole('dialog', { name: 'Revoke lee-laptop?' });
    expect(confirm.textContent).toMatch(/cannot sign in again until it enrolls again/);
    await user.click(within(confirm).getByRole('button', { name: 'Revoke' }));

    await waitFor(() =>
      expect(bridge.$fn('deploySecurity.revokeDevice')).toHaveBeenCalledWith('srv-1', LAPTOP.id),
    );
    expect(toast.success).toHaveBeenCalledWith('lee-laptop is revoked.');
  });

  it('warns before revoking this computer, and asks who is signed in afterwards', async () => {
    const { user, queryClient } = renderCard();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(await screen.findByRole('button', { name: 'Revoke Maria-PC' }));
    const confirm = await screen.findByRole('dialog', { name: 'Revoke this computer?' });
    expect(confirm.textContent).toMatch(/has to enroll again/);
    await user.click(within(confirm).getByRole('button', { name: 'Revoke' }));

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.deployAccess('srv-1') }),
    );
  });

  it("passes on the core's refusal", async () => {
    const { user } = renderCard({
      bridge: {
        'deploySecurity.revokeDevice': async () => {
          throw new Error(
            "Error invoking remote method 'deploySecurity:revokeDevice': Error: You can only revoke your own devices.",
          );
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Revoke lee-laptop' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Revoke lee-laptop?' })).getByRole(
        'button',
        { name: 'Revoke' },
      ),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('You can only revoke your own devices.'),
    );
  });

  it('does nothing when the confirmation is declined', async () => {
    const { user, bridge } = renderCard();

    await user.click(await screen.findByRole('button', { name: 'Revoke lee-laptop' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    // The fake bridge only knows a path the code reached for, and this one never was.
    expect(() => bridge.$fn('deploySecurity.revokeDevice')).toThrow(/not been touched/);
  });
});
