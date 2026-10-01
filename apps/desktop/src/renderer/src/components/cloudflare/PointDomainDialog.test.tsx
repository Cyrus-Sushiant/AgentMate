import type { CloudflarePointDomainPlan } from '@shared/cloudflareTypes';
import type { DeployServer } from '@shared/deployTypes';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { ipcError, SETTINGS, ZONE } from './testing/fixtures';

/**
 * "Point domain to this server" (T5): pick a saved server and a name, see exactly which records
 * would be added, changed or removed, and only then apply. A second run has nothing to change.
 */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { PointDomainDialog } = await import('./PointDomainDialog');

const SERVER: DeployServer = {
  id: 'srv-1',
  nickname: 'Production',
  host: 'prod.example.net',
  port: 22,
  username: 'deployer',
  core: null,
  enrolled: false,
};
const DEV: DeployServer = { ...SERVER, id: 'devhost', nickname: 'DevHost', dev: true };

const PLAN: CloudflarePointDomainPlan = {
  zoneName: 'example.com',
  names: ['example.com', 'www.example.com'],
  addresses: { ipv4: ['203.0.113.10'], ipv6: [] },
  upToDate: false,
  changes: [
    {
      action: 'update',
      type: 'A',
      name: 'example.com',
      content: '203.0.113.10',
      previous: '198.51.100.4',
      proxied: true,
      recordId: 'a'.repeat(32),
    },
    {
      action: 'delete',
      type: 'CNAME',
      name: 'www.example.com',
      content: 'example.com',
      proxied: true,
      recordId: 'b'.repeat(32),
      reason: 'cname-conflict',
    },
    {
      action: 'create',
      type: 'A',
      name: 'www.example.com',
      content: '203.0.113.10',
      proxied: true,
    },
    {
      action: 'delete',
      type: 'AAAA',
      name: 'example.com',
      content: '2001:db8::99',
      proxied: true,
      recordId: 'c'.repeat(32),
      reason: 'other-address',
    },
  ],
};

function renderDialog(bridge: Record<string, unknown>) {
  const onOpenChange = vi.fn();
  const view = renderWithProviders(
    <PointDomainDialog zone={ZONE} open onOpenChange={onOpenChange} />,
    {
      bridge: { 'deploy.listServers': async () => [DEV, SERVER], ...bridge },
    },
  );
  return { ...view, onOpenChange };
}

describe('PointDomainDialog', () => {
  it('previews the changes in words, then applies them', async () => {
    const { user, bridge, onOpenChange, queryClient } = renderDialog({
      'cloudflare.planPointDomain': async () => PLAN,
      'cloudflare.pointDomain': async () => ({ plan: PLAN, applied: 4 }),
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const server = await screen.findByLabelText('Server');
    expect(within(server).queryByText('DevHost')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Preview changes' }));

    const expected = {
      zoneId: ZONE.id,
      name: '@',
      serverId: 'srv-1',
      includeWww: true,
      proxied: true,
    };
    expect(bridge.$fn('cloudflare.planPointDomain')).toHaveBeenCalledWith(expected);
    const changes = await screen.findByRole('list', { name: 'Changes' });
    expect(
      within(changes)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'ChangeA example.com198.51.100.4 to 203.0.113.10',
      'RemoveCNAME www.example.comexample.com: a CNAME cannot share a name with address records',
      'AddA www.example.com203.0.113.10',
      'RemoveAAAA example.com2001:db8::99: it points somewhere else',
    ]);
    await user.click(screen.getByRole('button', { name: 'Apply 4 changes' }));

    expect(bridge.$fn('cloudflare.pointDomain')).toHaveBeenCalledWith(expected);
    expect(toast.success).toHaveBeenCalledWith('example.com now points to Production.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.cloudflareRecords(ZONE.id) });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('says when everything already points at the server', async () => {
    const upToDate: CloudflarePointDomainPlan = {
      ...PLAN,
      upToDate: true,
      changes: [{ ...PLAN.changes[0], action: 'keep', previous: undefined }],
    };
    const { user } = renderDialog({ 'cloudflare.planPointDomain': async () => upToDate });

    await screen.findByLabelText('Server');
    await user.click(screen.getByRole('button', { name: 'Preview changes' }));

    expect(
      await screen.findByText(/already point at Production\. Nothing to change\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Apply/ })).toBeNull();
  });

  it('points a name inside the zone, DNS only and without www', async () => {
    const { user, bridge } = renderDialog({ 'cloudflare.planPointDomain': async () => PLAN });

    await screen.findByLabelText('Server');
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'app');
    await user.click(screen.getByRole('switch', { name: 'Also point www' }));
    await user.click(screen.getByRole('switch', { name: 'Proxy through Cloudflare' }));
    await user.click(screen.getByRole('button', { name: 'Preview changes' }));

    expect(bridge.$fn('cloudflare.planPointDomain')).toHaveBeenCalledWith({
      zoneId: ZONE.id,
      name: 'app',
      serverId: 'srv-1',
      includeWww: false,
      proxied: false,
    });
  });

  it('suggests a better SSL/TLS mode for a proxied domain', async () => {
    const { user, queryClient } = renderDialog({ 'cloudflare.planPointDomain': async () => PLAN });
    queryClient.setQueryData(queryKeys.cloudflareSettings(ZONE.id), {
      ...SETTINGS,
      ssl: { value: 'flexible', editable: true },
    });

    await screen.findByLabelText('Server');
    await user.click(screen.getByRole('button', { name: 'Preview changes' }));

    expect(await screen.findByText(/plain HTTP/)).toBeInTheDocument();
  });

  it('shows why a preview could not be made', async () => {
    const { user } = renderDialog({
      'cloudflare.planPointDomain': async () => {
        throw ipcError('planPointDomain', '10.0.0.5 is a private or local address.');
      },
    });

    await screen.findByLabelText('Server');
    await user.click(screen.getByRole('button', { name: 'Preview changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '10.0.0.5 is a private or local address.',
    );
  });

  it('points to Remote when there is no saved server', async () => {
    renderDialog({ 'deploy.listServers': async () => [DEV] });
    expect(await screen.findByText(/Save a server in Remote first/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview changes' })).toBeDisabled();
  });
});
