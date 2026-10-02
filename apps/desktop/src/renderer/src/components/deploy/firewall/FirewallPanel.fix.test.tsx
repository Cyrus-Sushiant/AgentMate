import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { SERVER, signedIn } from '../security/testing/fixtures';
import { changeSet, EXPOSURE, PRESETS, preview, status } from './testing/fixtures';

/**
 * The Security checklist's "Turn on the firewall" opens the Firewall section with the change
 * staged and its review open: SSH's rule first where the firewall lacks one, then turning it on,
 * so the lockout guard has nothing to refuse and the usual safe apply follows.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/stores/confirmStore', () => ({ confirmDialog: vi.fn(async () => true) }));

const { FirewallPanel } = await import('./FirewallPanel');

function renderPanel(rules = status().rules, roles = ['admin']) {
  return renderWithProviders(<FirewallPanel server={SERVER} />, {
    route: '/deploy?server=srv-1&view=firewall&fix=enable-firewall',
    bridge: {
      'deploy.access': async () => signedIn(roles),
      'deploy.connection': async () => ({ serverId: SERVER.id, state: 'online', since: 0 }),
      'deployFirewall.status': async () => status({ active: false, rules }),
      'deployFirewall.presets': async () => PRESETS,
      'deployFirewall.history': async () => [],
      'deployFirewall.exposure': async () => EXPOSURE,
      'deployFirewall.preview': async () => preview(),
      'deployFirewall.applyChanges': async () => changeSet(),
    },
  });
}

describe('FirewallPanel from the checklist', () => {
  it('stages SSH and turning on, and opens the review', async () => {
    const { bridge } = renderPanel([]);

    expect(await screen.findByRole('dialog', { name: 'Review the firewall change' })).toBeTruthy();
    await waitFor(() =>
      expect(bridge.$fn('deployFirewall.preview')).toHaveBeenCalledWith({
        serverId: 'srv-1',
        changes: [
          { kind: 'addRule', rule: { action: 'allow', protocol: 'tcp', port: 22 } },
          { kind: 'enable' },
        ],
      }),
    );
  });

  it('only turns it on when SSH is allowed already', async () => {
    const { bridge } = renderPanel();

    expect(await screen.findByRole('dialog', { name: 'Review the firewall change' })).toBeTruthy();
    await waitFor(() =>
      expect(bridge.$fn('deployFirewall.preview')).toHaveBeenCalledWith({
        serverId: 'srv-1',
        changes: [{ kind: 'enable' }],
      }),
    );
  });

  it('stages nothing for a role that cannot change the firewall', async () => {
    renderPanel([], ['viewer']);

    expect(await screen.findByText('Firewall off')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
