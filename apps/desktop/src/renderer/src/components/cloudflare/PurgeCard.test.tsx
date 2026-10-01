import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { ipcError, ZONE } from './testing/fixtures';

/**
 * Purging the cache (T3): listed URLs straight away, everything only after typing the domain's
 * name, since a full purge sends every visitor's next request to the server.
 */

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { PurgeCard } = await import('./PurgeCard');

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
});

describe('PurgeCard', () => {
  it('purges the URLs listed, one per line', async () => {
    const { user, bridge } = renderWithProviders(<PurgeCard zone={ZONE} />, {
      bridge: { 'cloudflare.purgeCache': async () => undefined },
    });

    await user.type(
      screen.getByLabelText('URLs to purge'),
      'https://example.com/app.css{enter}https://example.com/app.js',
    );
    await user.click(screen.getByRole('button', { name: 'Purge these URLs' }));

    expect(bridge.$fn('cloudflare.purgeCache')).toHaveBeenCalledWith(ZONE.id, {
      urls: ['https://example.com/app.css', 'https://example.com/app.js'],
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Purged 2 URLs from the cache.'),
    );
    expect(screen.getByLabelText('URLs to purge')).toHaveValue('');
  });

  it('says what is wrong with the list before purging', async () => {
    const { user, bridge } = renderWithProviders(<PurgeCard zone={ZONE} />);

    await user.type(screen.getByLabelText('URLs to purge'), 'example.com/app.css');
    await user.click(screen.getByRole('button', { name: 'Purge these URLs' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Start it with https://');
    expect(() => bridge.$fn('cloudflare.purgeCache')).toThrow();
  });

  it('purges everything only once the domain name is typed', async () => {
    const { user, bridge } = renderWithProviders(<PurgeCard zone={ZONE} />, {
      bridge: { 'cloudflare.purgeCache': async () => undefined },
    });

    await user.click(screen.getByRole('button', { name: 'Purge everything' }));
    const dialog = await screen.findByRole('dialog', { name: 'Purge everything for example.com?' });
    const confirm = within(dialog).getByRole('button', { name: 'Purge everything' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/to confirm/), 'example.co');
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/to confirm/), 'm');
    await user.click(confirm);

    expect(bridge.$fn('cloudflare.purgeCache')).toHaveBeenCalledWith(ZONE.id, { everything: true });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Purged everything for example.com.'),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the dialog open with the reason when the purge fails', async () => {
    const { user } = renderWithProviders(<PurgeCard zone={ZONE} />, {
      bridge: {
        'cloudflare.purgeCache': async () => {
          throw ipcError('purgeCache', 'This token is not allowed to purge the cache.');
        },
      },
    });

    await user.click(screen.getByRole('button', { name: 'Purge everything' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/to confirm/), 'example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Purge everything' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('not allowed to purge');
  });

  it('passes on a failed purge of listed URLs', async () => {
    const { user } = renderWithProviders(<PurgeCard zone={ZONE} />, {
      bridge: {
        'cloudflare.purgeCache': async () => {
          throw ipcError('purgeCache', 'Cloudflare took too long to answer.');
        },
      },
    });
    await user.type(screen.getByLabelText('URLs to purge'), 'https://example.com/a');
    await user.click(screen.getByRole('button', { name: 'Purge these URLs' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('took too long');
  });
});
