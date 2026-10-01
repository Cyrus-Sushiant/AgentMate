import { encodeCloudflareError } from '@shared/cloudflareErrors';
import type { CloudflareDnsRecord } from '@shared/cloudflareTypes';
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogHost } from '@/components/ConfirmDialog';
import { queryKeys } from '@/lib/queryKeys';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { A_RECORD, ipcError, ZONE } from './testing/fixtures';

/**
 * A zone's DNS records (T2): every record in words, the proxy shown as text as well as a switch,
 * and changes that only go through once the user has seen what they do.
 */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { DnsRecordsCard } = await import('./DnsRecordsCard');

const RECORDS: CloudflareDnsRecord[] = [
  A_RECORD,
  {
    ...A_RECORD,
    id: 'b'.repeat(32),
    type: 'TXT',
    name: '_dmarc.example.com',
    content: 'v=DMARC1; p=none',
    ttl: 3600,
    proxied: false,
    proxiable: false,
  },
  {
    ...A_RECORD,
    id: 'c'.repeat(32),
    type: 'NS',
    name: 'sub.example.com',
    content: 'ns1.example.net',
    proxied: false,
    proxiable: false,
    editable: false,
  },
];

function renderCard(bridge: Record<string, unknown>) {
  return renderWithProviders(
    <>
      <DnsRecordsCard zone={ZONE} />
      <ConfirmDialogHost />
    </>,
    { bridge: { 'deploy.listServers': async () => [], ...bridge } },
  );
}

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
});

describe('DnsRecordsCard', () => {
  it('shimmers while the records load', () => {
    const { container } = renderCard({
      'cloudflare.listRecords': () => new Promise(() => undefined),
    });
    expect(container.querySelector('[aria-busy="true"] .shimmer')).not.toBeNull();
  });

  it('says what went wrong and tries again', async () => {
    let calls = 0;
    const { user } = renderCard({
      'cloudflare.listRecords': async () => {
        calls += 1;
        if (calls === 1) throw ipcError('listRecords', 'Could not reach Cloudflare.');
        return [];
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach Cloudflare.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/No DNS records yet/)).toBeInTheDocument();
  });

  it('lists records with the proxy in words and read-only types marked', async () => {
    renderCard({ 'cloudflare.listRecords': async () => RECORDS });

    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(RECORDS.length + 1);
    const apex = within(rows[1]);
    expect(apex.getByText('A')).toBeInTheDocument();
    expect(apex.getByText('@')).toBeInTheDocument();
    expect(apex.getByText('203.0.113.10')).toBeInTheDocument();
    expect(apex.getByText('Proxied')).toBeInTheDocument();
    expect(apex.getByText('Auto')).toBeInTheDocument();
    const txt = within(rows[2]);
    expect(txt.getByText('_dmarc')).toBeInTheDocument();
    expect(txt.getByText('DNS only')).toBeInTheDocument();
    expect(txt.getByText('1 hr')).toBeInTheDocument();
    expect(txt.queryByRole('switch')).toBeNull();
    expect(within(rows[3]).getByText('Edit on Cloudflare')).toBeInTheDocument();
    expect(within(rows[3]).queryByRole('button', { name: /Edit/ })).toBeNull();
  });

  it('turns the proxy off with the rest of the record unchanged', async () => {
    const { user, bridge } = renderCard({
      'cloudflare.listRecords': async () => [A_RECORD],
      'cloudflare.updateRecord': async () => ({ ...A_RECORD, proxied: false }),
    });

    await user.click(
      await screen.findByRole('switch', { name: 'Proxy example.com through Cloudflare' }),
    );

    expect(bridge.$fn('cloudflare.updateRecord')).toHaveBeenCalledWith(ZONE.id, A_RECORD.id, {
      type: 'A',
      name: 'example.com',
      content: '203.0.113.10',
      ttl: 1,
      proxied: false,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('example.com is DNS only now.'));
  });

  it('names the missing permission when Cloudflare refuses the change', async () => {
    const { user, queryClient } = renderCard({
      'cloudflare.listRecords': async () => [A_RECORD],
      'cloudflare.updateRecord': async () => {
        throw ipcError(
          'updateRecord',
          encodeCloudflareError(
            'missing-permission',
            'This token is not allowed to change DNS records.',
            'dns',
          ),
        );
      },
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(
      await screen.findByRole('switch', { name: 'Proxy example.com through Cloudflare' }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('This token is not allowed to change DNS records.'),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.cloudflareStatus });
  });

  it('deletes a record only after asking', async () => {
    const { user, bridge } = renderCard({
      'cloudflare.listRecords': async () => [A_RECORD],
      'cloudflare.deleteRecord': async () => undefined,
    });

    await user.click(
      await screen.findByRole('button', { name: 'Delete the A record for example.com' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Delete the A record for example.com?');
    await user.click(within(dialog).getByRole('button', { name: 'Delete record' }));

    expect(bridge.$fn('cloudflare.deleteRecord')).toHaveBeenCalledWith(ZONE.id, A_RECORD.id);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Deleted the A record for example.com.'),
    );
  });

  it('keeps the record when the question is dismissed', async () => {
    const { user, bridge } = renderCard({
      'cloudflare.listRecords': async () => [A_RECORD],
      'cloudflare.deleteRecord': async () => undefined,
    });

    await user.click(
      await screen.findByRole('button', { name: 'Delete the A record for example.com' }),
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );

    expect(() => bridge.$fn('cloudflare.deleteRecord')).toThrow();
  });

  it('opens the editor for a new record and for an existing one', async () => {
    const { user } = renderCard({ 'cloudflare.listRecords': async () => [A_RECORD] });

    await user.click(await screen.findByRole('button', { name: 'Add record' }));
    expect(await screen.findByRole('dialog', { name: 'Add a DNS record' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Edit the A record for example.com' }));
    expect(await screen.findByRole('dialog', { name: 'Edit the A record' })).toBeInTheDocument();
  });

  it('opens "point domain to a server"', async () => {
    const { user } = renderCard({ 'cloudflare.listRecords': async () => [] });
    await user.click(await screen.findByRole('button', { name: 'Point domain to a server' }));
    expect(
      await screen.findByRole('dialog', { name: 'Point a domain to a server' }),
    ).toBeInTheDocument();
  });
});
