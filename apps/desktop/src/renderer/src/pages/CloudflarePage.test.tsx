import type { CloudflareStatus } from '@shared/cloudflareTypes';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PANEL_WIDTHS, usePanelWidthStore } from '@/stores/panelWidthStore';
import { renderWithProviders } from '../../../test/renderer/renderWithProviders';
import {
  A_RECORD,
  ACCOUNT,
  CONNECTED,
  ipcError,
  OTHER_ZONE,
  SETTINGS,
  ZONE,
} from '../components/cloudflare/testing/fixtures';

/**
 * The Cloudflare page (T8) at /deploy/cloudflare: account wide, so it starts from the token,
 * then lists the zones it can see, and for the picked zone its DNS, settings and security rules.
 * Every state says what is going on in words, and loading shimmers card by card.
 */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { default: CloudflarePage } = await import('./CloudflarePage');

const NOTHING: CloudflareStatus = { configured: false, locked: false, accounts: [] };

function renderPage(bridge: Record<string, unknown> = {}, route = '/deploy/cloudflare') {
  return renderWithProviders(<CloudflarePage />, {
    route,
    bridge: {
      'cloudflare.status': async () => CONNECTED,
      'cloudflare.listZones': async () => [ZONE, OTHER_ZONE],
      'cloudflare.listRecords': async () => [A_RECORD],
      'cloudflare.zoneSettings': async () => SETTINGS,
      'cloudflare.listCustomRules': async () => [],
      'cloudflare.listAccessRules': async () => [],
      'ssh.vaultStatus': async () => ({ hasPasskey: false, unlocked: false }),
      'deploy.listServers': async () => [],
      ...bridge,
    },
  });
}

describe('CloudflarePage', () => {
  it('shimmers while it asks whether a token is saved', () => {
    const { container } = renderPage({ 'cloudflare.status': () => new Promise(() => undefined) });
    expect(container.querySelector('[aria-busy="true"] .shimmer')).not.toBeNull();
  });

  it('says what went wrong when the status cannot be read', async () => {
    renderPage({
      'cloudflare.status': async () => {
        throw ipcError('status', 'Cloudflare is only available in the main window.');
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('only available in the main window');
  });

  it('starts with the token guide when nothing is saved', async () => {
    const { bridge } = renderPage({ 'cloudflare.status': async () => NOTHING });

    expect(await screen.findByText('Connect Cloudflare')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Deploy/ })).toHaveAttribute('href', '/deploy');
    expect(() => bridge.$fn('cloudflare.listZones')).toThrow();
  });

  it('lists the zones and opens the first one on its DNS records', async () => {
    renderPage();

    const rail = await screen.findByRole('navigation', { name: 'Zones' });
    expect(await within(rail).findByText('example.com')).toBeInTheDocument();
    expect(within(rail).getByText('Waiting for name servers')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'example.com' })).toBeInTheDocument();
    expect(await screen.findByText('DNS records')).toBeInTheDocument();
  });

  it('opens the zone in the address and switches between its tabs', async () => {
    const { user } = renderPage({}, `/deploy/cloudflare?zone=${OTHER_ZONE.id}`);

    expect(await screen.findByRole('heading', { name: 'example.org' })).toBeInTheDocument();
    expect(screen.getByText(/bob\.ns\.cloudflare\.com/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(await screen.findByLabelText('Security level')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cache' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Security' }));
    expect(await screen.findByRole('heading', { name: 'WAF custom rules' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'IP access rules' })).toBeInTheDocument();
  });

  it('marks the open zone in the rail', async () => {
    const { user } = renderPage();
    const rail = await screen.findByRole('navigation', { name: 'Zones' });
    const first = await within(rail).findByRole('button', { name: /example\.com/ });
    const second = within(rail).getByRole('button', { name: /example\.org/ });
    expect(first).toHaveAttribute('aria-current', 'true');
    expect(second).not.toHaveAttribute('aria-current');
    await user.click(second);
    expect(second).toHaveAttribute('aria-current', 'true');
    expect(first).not.toHaveAttribute('aria-current');
  });

  it('resizes the domain list from the keyboard and remembers the width', async () => {
    usePanelWidthStore.setState({ widths: {} });
    const { user } = renderPage();
    await screen.findByRole('navigation', { name: 'Zones' });
    const handle = screen.getByRole('separator', { name: 'Resize domains' });
    const rail = screen.getByRole('complementary', { name: 'Cloudflare domains' });
    expect(rail.style.width).toBe(`${PANEL_WIDTHS.cloudflareRail.default}px`);

    handle.focus();
    await user.keyboard('{ArrowRight}');
    const wider = usePanelWidthStore.getState().widths.cloudflareRail ?? 0;
    expect(wider).toBeGreaterThan(PANEL_WIDTHS.cloudflareRail.default);
    expect(rail.style.width).toBe(`${wider}px`);
  });

  it('shows the token guide on its own, without an empty domain list', async () => {
    renderPage({ 'cloudflare.status': async () => NOTHING });
    expect(await screen.findByText('Connect Cloudflare')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Cloudflare domains' })).toBeNull();
    expect(screen.queryByRole('separator', { name: 'Resize domains' })).toBeNull();
  });

  it('picks another zone from the rail', async () => {
    const { user } = renderPage();
    const rail = await screen.findByRole('navigation', { name: 'Zones' });
    await user.click(await within(rail).findByRole('button', { name: /example\.org/ }));
    expect(await screen.findByRole('heading', { name: 'example.org' })).toBeInTheDocument();
  });

  it('shimmers while the zones load, and explains when there are none', async () => {
    const { container, unmount } = renderPage({
      'cloudflare.listZones': () => new Promise(() => undefined),
    });
    await screen.findByText('Cloudflare token');
    expect(container.querySelector('nav[aria-busy="true"] .shimmer')).not.toBeNull();
    unmount();

    renderPage({ 'cloudflare.listZones': async () => [] });
    expect(await screen.findByText(/cannot see any domains yet/)).toBeInTheDocument();
  });

  it('says why the zones could not be listed', async () => {
    renderPage({
      'cloudflare.listZones': async () => {
        throw ipcError('listZones', 'Could not reach Cloudflare.');
      },
    });
    expect(await screen.findByText('Could not reach Cloudflare.')).toBeInTheDocument();
  });

  it('asks to unlock the Servers passkey before reading anything with the token', async () => {
    const { user, bridge } = renderPage({
      'cloudflare.status': async () => ({ ...CONNECTED, locked: true }),
      'ssh.vaultStatus': async () => ({ hasPasskey: true, unlocked: false }),
    });

    expect(await screen.findByText(/locked with a passkey/)).toBeInTheDocument();
    expect(() => bridge.$fn('cloudflare.listZones')).toThrow();
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('replaces the token from the token card, or keeps it', async () => {
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Replace token' }));
    expect(await screen.findByText('Replace the token for Cloudflare')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep the current token' }));
    expect(await screen.findByText('Cloudflare token')).toBeInTheDocument();
  });

  it('reads the zones once the passkey is unlocked', async () => {
    let locked = true;
    const { user, bridge } = renderPage({
      'cloudflare.status': async () => ({ ...CONNECTED, locked }),
      'ssh.vaultStatus': async () => ({ hasPasskey: true, unlocked: !locked }),
      'ssh.unlockVault': async () => {
        locked = false;
        return true;
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Unlock' }));
    await user.type(await screen.findByLabelText('Passkey'), 'secret');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByRole('navigation', { name: 'Zones' })).toBeInTheDocument();
    expect(bridge.$fn('cloudflare.listZones')).toHaveBeenCalled();
  });

  it('tries the status and the zones again on request', async () => {
    let failStatus = true;
    let failZones = true;
    const { user } = renderPage({
      'cloudflare.status': async () => {
        if (failStatus) {
          failStatus = false;
          throw ipcError('status', 'Busy.');
        }
        return CONNECTED;
      },
      'cloudflare.listZones': async () => {
        if (failZones) {
          failZones = false;
          throw ipcError('listZones', 'Could not reach Cloudflare.');
        }
        return [ZONE];
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Could not reach Cloudflare.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'example.com' })).toBeInTheDocument();
  });

  describe('with several accounts', () => {
    const SECOND_ZONE = { ...OTHER_ZONE, accountId: 'acct-2' };
    const TWO: CloudflareStatus = {
      configured: true,
      locked: false,
      accounts: [ACCOUNT, { ...ACCOUNT, id: 'acct-2', label: 'Client Co' }],
    };
    const several = {
      'cloudflare.status': async () => TWO,
      'cloudflare.listZones': async (accountId: string) =>
        accountId === 'acct-2' ? [SECOND_ZONE] : [ZONE],
    };

    it('groups the domains under the account that holds them', async () => {
      renderPage(several);

      const rail = await screen.findByRole('navigation', { name: 'Zones' });
      const work = await within(rail).findByRole('region', { name: 'Cloudflare' });
      const client = within(rail).getByRole('region', { name: 'Client Co' });
      expect(await within(work).findByText('example.com')).toBeInTheDocument();
      expect(await within(client).findByText('example.org')).toBeInTheDocument();
      expect(within(work).queryByText('example.org')).toBeNull();
    });

    it('asks each account for its own zones', async () => {
      const { bridge } = renderPage(several);
      await screen.findByRole('heading', { name: 'example.com' });
      expect(bridge.$fn('cloudflare.listZones')).toHaveBeenCalledWith('acct-1');
      expect(bridge.$fn('cloudflare.listZones')).toHaveBeenCalledWith('acct-2');
    });

    it('shows the token card of the account that holds the open zone', async () => {
      const { user } = renderPage(several);
      const rail = await screen.findByRole('navigation', { name: 'Zones' });

      expect(await screen.findByRole('heading', { name: 'example.com' })).toBeInTheDocument();
      expect(screen.getAllByText('Client Co')).toHaveLength(1);
      await user.click(await within(rail).findByRole('button', { name: /example.org/ }));

      expect(await screen.findByRole('heading', { name: 'example.org' })).toBeInTheDocument();
      expect(screen.getAllByText('Client Co')).toHaveLength(2);
    });

    it('keeps the other accounts domains when one account fails', async () => {
      renderPage({
        ...several,
        'cloudflare.listZones': async (accountId: string) => {
          if (accountId === 'acct-2') throw ipcError('listZones', 'Could not reach Cloudflare.');
          return [ZONE];
        },
      });

      expect(await screen.findByText('Could not reach Cloudflare.')).toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: 'example.com' })).toBeInTheDocument();
    });

    it('adds another account from the rail, and goes back without saving', async () => {
      const { user } = renderPage(several);

      await user.click(await screen.findByRole('button', { name: 'Add account' }));
      expect(await screen.findByText('Connect another Cloudflare account')).toBeInTheDocument();
      expect(screen.getByLabelText('Name (optional)')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await screen.findByRole('navigation', { name: 'Zones' })).toBeInTheDocument();
    });

    it('lets the first account be added from the one-column view too', async () => {
      const { user } = renderPage({
        ...several,
        'cloudflare.status': async () => ({ ...TWO, locked: true }),
        'ssh.vaultStatus': async () => ({ hasPasskey: true, unlocked: false }),
      });

      expect(await screen.findByText(/locked with a passkey/)).toBeInTheDocument();
      expect(screen.getByText('Client Co')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Add another account' }));
      expect(await screen.findByText('Connect another Cloudflare account')).toBeInTheDocument();
    });
  });
});
