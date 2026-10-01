import { TOKEN_PAGE } from '@shared/cloudflare/permissions';
import type { CloudflareStatus, CloudflareTokenReport } from '@shared/cloudflareTypes';
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

function status(report: Partial<CloudflareTokenReport> = {}): CloudflareStatus {
  return { configured: true, locked: false, report: { ...ALL_GRANTED, ...report } };
}

function renderCard(current: CloudflareStatus, bridge: Record<string, unknown> = {}) {
  const onReplace = vi.fn();
  const view = renderWithProviders(
    <>
      <TokenStatusCard status={current} onReplace={onReplace} />
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
    const fixed = status();
    const { user, bridge, queryClient } = renderCard(
      status({ permissions: [{ id: 'dns', state: 'missing' }] }),
      { 'cloudflare.checkToken': async () => fixed },
    );

    await user.click(screen.getAllByRole('button', { name: 'Check again' })[0]);

    expect(bridge.$fn('cloudflare.checkToken')).toHaveBeenCalled();
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
      'cloudflare.removeToken': async () => undefined,
    });
    queryClient.setQueryData(queryKeys.cloudflareZones, []);

    await user.click(screen.getByRole('button', { name: 'Replace token' }));
    expect(onReplace).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove token' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove the token' }));

    expect(bridge.$fn('cloudflare.removeToken')).toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.cloudflareStatus)).toEqual({
      configured: false,
      locked: false,
      report: null,
    });
    expect(queryClient.getQueryData(queryKeys.cloudflareZones)).toBeUndefined();
  });
});
