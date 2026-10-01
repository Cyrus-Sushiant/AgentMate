import type { CloudflareCustomRule } from '@shared/cloudflareTypes';
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogHost } from '@/components/ConfirmDialog';
import { queryKeys } from '@/lib/queryKeys';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { ipcError, ZONE } from './testing/fixtures';

/** WAF custom rules (T4): the zone's rules in words, each one switched on or off or deleted. */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { CustomRulesCard } = await import('./CustomRulesCard');

const RULE: CloudflareCustomRule = {
  id: '3a03d665bac047339bb530ecb439a90d',
  description: 'Block Tor exit nodes',
  expression: '(ip.src.country in {"T1"})',
  action: 'block',
  enabled: true,
  lastUpdated: '2024-06-01T12:00:00Z',
};

function renderCard(bridge: Record<string, unknown>) {
  return renderWithProviders(
    <>
      <CustomRulesCard zone={ZONE} />
      <ConfirmDialogHost />
    </>,
    { bridge },
  );
}

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
});

describe('CustomRulesCard', () => {
  it('shimmers, then explains an empty zone', async () => {
    const { container } = renderCard({
      'cloudflare.listCustomRules': () => new Promise(() => undefined),
    });
    expect(container.querySelector('[aria-busy="true"] .shimmer')).not.toBeNull();
  });

  it('says there are no rules yet', async () => {
    renderCard({ 'cloudflare.listCustomRules': async () => [] });
    expect(await screen.findByText(/No custom rules yet/)).toBeInTheDocument();
  });

  it('says what went wrong', async () => {
    renderCard({
      'cloudflare.listCustomRules': async () => {
        throw ipcError('listCustomRules', 'This token is not allowed to change WAF custom rules.');
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('WAF custom rules');
  });

  it('lists rules with their action and state in words', async () => {
    renderCard({
      'cloudflare.listCustomRules': async () => [
        RULE,
        { ...RULE, id: 'b'.repeat(32), enabled: false, action: 'skip', description: 'Office' },
      ],
    });

    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]).getByText('Block Tor exit nodes')).toBeInTheDocument();
    expect(within(items[0]).getByText('Block')).toBeInTheDocument();
    expect(within(items[0]).getByText('(ip.src.country in {"T1"})')).toBeInTheDocument();
    expect(within(items[0]).getByText('On')).toBeInTheDocument();
    expect(within(items[1]).getByText('Allow (skip the other rules)')).toBeInTheDocument();
    expect(within(items[1]).getByText('Off')).toBeInTheDocument();
  });

  it('switches a rule off', async () => {
    const off = { ...RULE, enabled: false };
    const { user, bridge, queryClient } = renderCard({
      'cloudflare.listCustomRules': async () => [RULE],
      'cloudflare.setCustomRuleEnabled': async () => [off],
    });

    await user.click(await screen.findByRole('switch', { name: 'Block Tor exit nodes' }));

    expect(bridge.$fn('cloudflare.setCustomRuleEnabled')).toHaveBeenCalledWith(
      ZONE.id,
      RULE.id,
      false,
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.cloudflareCustomRules(ZONE.id))).toEqual([off]),
    );
    expect(toast.success).toHaveBeenCalledWith('Block Tor exit nodes is off.');
  });

  it('deletes a rule only after asking', async () => {
    const { user, bridge } = renderCard({
      'cloudflare.listCustomRules': async () => [RULE],
      'cloudflare.deleteCustomRule': async () => [],
    });

    await user.click(
      await screen.findByRole('button', { name: 'Delete the rule Block Tor exit nodes' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete rule' }));

    expect(bridge.$fn('cloudflare.deleteCustomRule')).toHaveBeenCalledWith(ZONE.id, RULE.id);
    expect(await screen.findByText(/No custom rules yet/)).toBeInTheDocument();
  });

  it('passes on a refused change', async () => {
    const { user } = renderCard({
      'cloudflare.listCustomRules': async () => [RULE],
      'cloudflare.setCustomRuleEnabled': async () => {
        throw ipcError(
          'setCustomRuleEnabled',
          'That rule is not in this zone any more. Refresh the list.',
        );
      },
    });
    await user.click(await screen.findByRole('switch', { name: 'Block Tor exit nodes' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'That rule is not in this zone any more. Refresh the list.',
      ),
    );
  });

  it('opens the rule builder', async () => {
    const { user } = renderCard({ 'cloudflare.listCustomRules': async () => [] });
    await user.click(await screen.findByRole('button', { name: 'Add rule' }));
    expect(await screen.findByRole('dialog', { name: 'Add a custom rule' })).toBeInTheDocument();
  });
});
