import { tokenTemplateUrl } from '@shared/cloudflare/permissions';
import type { CloudflareStatus } from '@shared/cloudflareTypes';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';

/**
 * Connecting Cloudflare: the guide lists exactly the permissions to give the token and opens
 * Cloudflare's page with them filled in; the pasted token goes to the main process once, to be
 * checked and sealed, and the field empties straight after.
 */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { TokenSetupCard } = await import('./TokenSetupCard');

const TOKEN = 'Gm4pR2e6Tq9VxYb1Lk0NsHjW3cZaDf7U8iOoPl5M';
const SAVED: CloudflareStatus = {
  configured: true,
  locked: false,
  accounts: [
    {
      id: 'acct-1',
      label: 'Work',
      locked: false,
      report: {
        tokenId: 'ed17574386854bf78a67040be0a770b0',
        status: 'active',
        expiresOn: null,
        source: 'probes',
        permissions: [],
        zoneCount: 1,
        checkedAt: Date.now(),
      },
    },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  toast.success.mockClear();
});

describe('TokenSetupCard', () => {
  it('lists every permission the token needs and opens the token page with them filled in', async () => {
    const { user, bridge } = renderWithProviders(<TokenSetupCard />);

    for (const label of [
      'Zone > Zone > Read',
      'Zone > DNS > Edit',
      'Zone > Zone Settings > Edit',
      'Zone > Cache Purge > Purge',
      'Zone > Zone WAF > Edit',
      'Zone > Firewall Services > Edit',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: "Open Cloudflare's token page" }));

    expect(bridge.$fn('shell.openExternal')).toHaveBeenCalledWith(tokenTemplateUrl());
  });

  it('saves a pasted token, then empties the field', async () => {
    const saving = deferred<CloudflareStatus>();
    const { user, bridge, queryClient } = renderWithProviders(<TokenSetupCard />, {
      bridge: { 'cloudflare.saveToken': () => saving.promise },
    });

    const field = screen.getByLabelText('API token');
    await user.type(field, TOKEN);
    await user.click(screen.getByRole('button', { name: 'Save and check' }));

    expect(bridge.$fn('cloudflare.saveToken')).toHaveBeenCalledWith({ token: TOKEN });
    expect(screen.getByRole('button', { name: /Checking with Cloudflare/ })).toBeDisabled();
    saving.resolve(SAVED);

    expect(await screen.findByRole('button', { name: 'Save and check' })).toBeInTheDocument();
    expect(field).toHaveValue('');
    expect(queryClient.getQueryData(queryKeys.cloudflareStatus)).toEqual(SAVED);
    expect(toast.success).toHaveBeenCalledWith('Cloudflare account connected.');
  });

  it('connects another account under the name typed for it', async () => {
    const { user, bridge } = renderWithProviders(<TokenSetupCard additional />, {
      bridge: { 'cloudflare.saveToken': async () => SAVED },
    });

    expect(screen.getByText('Connect another Cloudflare account')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name (optional)'), '  Client Co ');
    await user.type(screen.getByLabelText('API token'), TOKEN);
    await user.click(screen.getByRole('button', { name: 'Save and check' }));

    expect(bridge.$fn('cloudflare.saveToken')).toHaveBeenCalledWith({
      token: TOKEN,
      label: 'Client Co',
    });
  });

  it('replaces the token of one account without asking for a name again', async () => {
    const { user, bridge } = renderWithProviders(
      <TokenSetupCard account={{ id: 'acct-1', label: 'Work' }} />,
      { bridge: { 'cloudflare.saveToken': async () => SAVED } },
    );

    expect(screen.getByText('Replace the token for Work')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name (optional)')).toBeNull();
    await user.type(screen.getByLabelText('API token'), TOKEN);
    await user.click(screen.getByRole('button', { name: 'Save and check' }));

    expect(bridge.$fn('cloudflare.saveToken')).toHaveBeenCalledWith({
      token: TOKEN,
      accountId: 'acct-1',
    });
    expect(toast.success).toHaveBeenCalledWith('Replaced the token for Work.');
  });

  it('says why pasted text cannot be a token, without sending it anywhere', async () => {
    const { user, bridge } = renderWithProviders(<TokenSetupCard />);

    await user.type(screen.getByLabelText('API token'), '0123456789abcdef0123456789abcdef01234');
    await user.click(screen.getByRole('button', { name: 'Save and check' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Global API Key/);
    expect(() => bridge.$fn('cloudflare.saveToken')).toThrow();
  });

  it('shows what Cloudflare said when it does not accept the token', async () => {
    const { user } = renderWithProviders(<TokenSetupCard />, {
      bridge: {
        'cloudflare.saveToken': async () => {
          throw new Error(
            "Error invoking remote method 'cloudflare:saveToken': Error: Cloudflare did not accept this token.",
          );
        },
      },
    });

    await user.type(screen.getByLabelText('API token'), TOKEN);
    await user.click(screen.getByRole('button', { name: 'Save and check' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cloudflare did not accept this token.',
    );
  });

  it('offers to keep the current token when it replaces one', async () => {
    const onCancel = vi.fn();
    const { user } = renderWithProviders(
      <TokenSetupCard account={{ id: 'acct-1', label: 'Work' }} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole('button', { name: 'Keep the current token' }));

    expect(onCancel).toHaveBeenCalled();
  });

  it('offers to cancel when it adds another account', async () => {
    const onCancel = vi.fn();
    const { user } = renderWithProviders(<TokenSetupCard additional onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
  });
});
