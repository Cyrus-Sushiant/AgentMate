import { TOKEN_PAGE } from '@shared/cloudflare/permissions';
import type {
  CloudflareAccountStatus,
  CloudflareStatus,
  CloudflareTokenReport,
} from '@shared/cloudflareTypes';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialogHost } from '@/components/ConfirmDialog';
import { queryKeys } from '@/lib/queryKeys';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';

/**
 * The saved token: what it may do, in words, and when something is missing, exactly what to add
 * on Cloudflare (AC1), with a way to check again once it is added.
 */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { TokenStatusCard } = await import('./TokenStatusCard');

const ALL_GRANTED: CloudflareTokenReport = {
  tokenId: 'ed17574386854bf78a67040be0a770b0',
  status: 'active',
  expiresOn: null,
  source: 'probes',
  permissions: [
    { id: 'zone', state: 'granted' },
    { id: 'dns', state: 'granted' },
    { id: 'zoneSettings', state: 'granted' },
    { id: 'cachePurge', state: 'unverified' },
    { id: 'waf', state: 'granted' },
    { id: 'accessRules', state: 'granted' },
  ],
  zoneCount: 2,
  checkedAt: Date.now() - 5 * 60_000,
};

function status(report: Partial<CloudflareTokenReport> = {}): CloudflareAccountStatus {
  return {
    id: 'acct-1',
    label: 'Work',
    locked: false,
    report: { ...ALL_GRANTED, ...report },
  };
}

/** `defaultOpen` is on here so most tests start with the details showing; the folding has its own. */
function renderCard(
  current: CloudflareAccountStatus,
  bridge: Record<string, unknown> = {},
  showName = false,
  defaultOpen = true,
) {
  const onReplace = vi.fn();
  const view = renderWithProviders(
    <>
      <TokenStatusCard
        account={current}
        showName={showName}
        defaultOpen={defaultOpen}
        onReplace={onReplace}
      />
      <ConfirmDialogHost />
    </>,
    { bridge },
  );
  return { ...view, onReplace };
}

describe('TokenStatusCard', () => {
  it('shows every permission with its state in words', () => {
    renderCard(status());

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getAllByText('Granted')).toHaveLength(5);
    expect(screen.getByText('Checked when first used')).toBeInTheDocument();
    expect(screen.getByText(/Checked by reading, which changes nothing/)).toBeInTheDocument();
    expect(screen.getByText(/2 domains/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'What to add to the token' })).toBeNull();
  });

  it('lists exactly what to add when permissions are missing (AC1)', async () => {
    const { user, bridge } = renderCard(
      status({
        source: 'policies',
        permissions: ALL_GRANTED.permissions.map((check) =>
          check.id === 'dns' || check.id === 'waf' ? { ...check, state: 'missing' } : check,
        ),
      }),
    );

    expect(screen.getByText('Missing permissions')).toBeInTheDocument();
    const fix = screen.getByRole('region', { name: 'What to add to the token' });
    expect(
      within(fix)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Zone > DNS > Edit', 'Zone > Zone WAF > Edit']);
    expect(screen.getByText(/Read from the token's own permissions/)).toBeInTheDocument();

    await user.click(within(fix).getByRole('button', { name: 'Edit the token on Cloudflare' }));
    expect(bridge.$fn('shell.openExternal')).toHaveBeenCalledWith(TOKEN_PAGE);
  });

  it('says when the token sees no domains at all', () => {
    renderCard(status({ zoneCount: 0, permissions: [{ id: 'zone', state: 'missing' }] }));
    expect(screen.getByText(/cannot see any domains/)).toBeInTheDocument();
  });

  it('checks again and shows the new answer', async () => {
    const fixed: CloudflareStatus = { configured: true, locked: false, accounts: [status()] };
    const { user, bridge, queryClient } = renderCard(
      status({ permissions: [{ id: 'dns', state: 'missing' }] }),
      { 'cloudflare.checkToken': async () => fixed },
    );

    await user.click(screen.getAllByRole('button', { name: 'Check again' })[0]);

    expect(bridge.$fn('cloudflare.checkToken')).toHaveBeenCalledWith('acct-1');
    expect(queryClient.getQueryData(queryKeys.cloudflareStatus)).toEqual(fixed);
    expect(toast.success).toHaveBeenCalledWith('Checked the token again.');
  });

  it('passes on a failed check', async () => {
    const { user } = renderCard(status(), {
      'cloudflare.checkToken': async () => {
        throw new Error('Could not reach Cloudflare.');
      },
    });
    await user.click(screen.getByRole('button', { name: 'Check again' }));
    expect(toast.error).toHaveBeenCalledWith('Could not reach Cloudflare.');
  });

  it('names a disabled or expired token', () => {
    renderCard(status({ status: 'expired' }));
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('removes the token only after asking, and offers to replace it', async () => {
    const { user, bridge, queryClient, onReplace } = renderCard(status(), {
      'cloudflare.removeToken': async () => ({ configured: false, locked: false, accounts: [] }),
    });
    queryClient.setQueryData(queryKeys.cloudflareZones, []);

    await user.click(screen.getByRole('button', { name: 'Replace token' }));
    expect(onReplace).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove token' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove the token' }));

    expect(bridge.$fn('cloudflare.removeToken')).toHaveBeenCalledWith('acct-1');
    expect(queryClient.getQueryData(queryKeys.cloudflareStatus)).toEqual({
      configured: false,
      locked: false,
      accounts: [],
    });
    expect(queryClient.getQueryData(queryKeys.cloudflareZones)).toBeUndefined();
  });

  it('names the account when several are connected, and only that one when removing', async () => {
    const left: CloudflareStatus = {
      configured: true,
      locked: false,
      accounts: [{ ...status(), id: 'acct-2', label: 'Client' }],
    };
    const { user, bridge, queryClient } = renderCard(
      status(),
      { 'cloudflare.removeToken': async () => left },
      true,
    );

    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.queryByText('Cloudflare token')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Remove token' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Remove Work?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remove the token' }));

    expect(bridge.$fn('cloudflare.removeToken')).toHaveBeenCalledWith('acct-1');
    expect(queryClient.getQueryData(queryKeys.cloudflareStatus)).toEqual(left);
    expect(toast.success).toHaveBeenCalledWith('Removed Work.');
  });

  describe('folding', () => {
    it('is one line while the token is fine, and unfolds on request', async () => {
      const { user } = renderCard(status(), {}, false, false);

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText(/It can see 2 domains/)).toBeInTheDocument();
      expect(screen.queryByText('Zone > DNS > Edit')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Replace token' })).toBeNull();

      const toggle = screen.getByRole('button', { name: 'Details' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await user.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Zone > DNS > Edit')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Replace token' })).toBeInTheDocument();
      await user.click(toggle);
      expect(screen.queryByText('Zone > DNS > Edit')).toBeNull();
    });

    it('opens by itself when a permission is missing', () => {
      renderCard(status({ permissions: [{ id: 'dns', state: 'missing' }] }), {}, false, false);

      expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(screen.getByRole('region', { name: 'What to add to the token' })).toBeInTheDocument();
    });

    it('opens by itself when the token is expired or sees no domains', () => {
      const { unmount } = renderCard(status({ status: 'expired' }), {}, false, false);
      expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      unmount();

      renderCard(status({ zoneCount: 0 }), {}, false, false);
      expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('opens by itself for a token that was never checked', () => {
      renderCard({ id: 'acct-1', label: 'Work', locked: false, report: null }, {}, false, false);

      expect(screen.getByText('Saved, but not checked yet.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Replace token' })).toBeInTheDocument();
    });
  });
});
