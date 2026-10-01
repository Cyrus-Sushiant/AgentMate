import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { MARIA, SERVER, signedIn, THIS_COMPUTER, THIS_SESSION } from './testing/fixtures';

/**
 * A server's Security area shows only what the signed-in role may use: users for Owners, the
 * audit trail for Admins and Owners, and everyone's own devices and sessions. Without a session
 * it offers the way in instead of a dead end.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { SecurityPanel } = await import('./SecurityPanel');

function renderPanel(access: unknown) {
  return renderWithProviders(<SecurityPanel server={SERVER} />, {
    bridge: {
      'deploy.access': access,
      'deploySecurity.listUsers': async () => [MARIA],
      'deploySecurity.listDevices': async () => [THIS_COMPUTER],
      'deploySecurity.listSessions': async () => [THIS_SESSION],
      'deploySecurity.queryAudit': async () => ({ events: [] }),
    },
  });
}

describe('SecurityPanel', () => {
  it('shimmers while it finds out who is signed in', () => {
    const { container } = renderPanel(() => new Promise(() => undefined));

    expect(container.querySelector('[aria-busy="true"] .shimmer')).not.toBeNull();
  });

  it('offers the way in when this computer is not signed in', async () => {
    renderPanel(async () => ({ state: 'needs-sign-in' }));

    expect(await screen.findByText('Sign in to manage this core.')).toBeTruthy();
    expect(screen.getByText(/Sign in to see who can reach Production/)).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('gives an Owner users, devices and sessions, and the audit trail, starting with users', async () => {
    const { user } = renderPanel(async () => signedIn(['owner']));

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Users',
      'Devices and sessions',
      'Audit trail',
    ]);
    expect(await screen.findByRole('listitem', { name: 'maria' })).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Audit trail' }));

    expect(await screen.findByText('Nothing has been recorded yet.')).toBeTruthy();
  });

  it('gives an Admin devices of everyone and the audit trail, but no users', async () => {
    renderPanel(async () => signedIn(['admin']));

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Devices and sessions', 'Audit trail']);
    expect(await screen.findByText(/Every computer enrolled on this core/)).toBeTruthy();
    const devices = await screen.findByRole('list', { name: 'Devices' });
    expect(within(devices).getByRole('listitem', { name: 'Maria-PC' })).toBeTruthy();
  });

  it('moves an Owner who stepped down off the Users tab', async () => {
    const { queryClient } = renderPanel(async () => signedIn(['owner']));
    expect(await screen.findByRole('tab', { name: 'Users' })).toBeTruthy();

    act(() => {
      queryClient.setQueryData(queryKeys.deployAccess('srv-1'), signedIn(['admin']));
    });

    expect(await screen.findByText(/Every computer enrolled on this core/)).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Users' })).toBeNull();
  });

  it('gives a Viewer their own devices and sessions only', async () => {
    renderPanel(async () => signedIn(['viewer']));

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Devices and sessions']);
    expect(await screen.findByText(/Your computers enrolled on this core/)).toBeTruthy();
    expect(screen.getByText('Your sessions')).toBeTruthy();
  });
});
