import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { InstallSystemImage } from './InstallSystemImage';

/**
 * The panel that appears when no system image is installed. Fetching the list can fail for a
 * dozen reasons, so it has to say which one and let the user try again without reopening
 * anything.
 */

const AVAILABLE = [
  {
    id: 'system-images;android-36;google_apis;x86_64',
    api: 36,
    tag: 'google_apis',
    abi: 'x86_64',
    playStore: false,
    version: '3',
    description: '',
  },
];

function setup(overrides: Record<string, unknown> = {}) {
  const onInstalled = vi.fn();
  const view = renderWithProviders(<InstallSystemImage onInstalled={onInstalled} />, {
    bridge: {
      'android.availableSystemImages': { images: AVAILABLE, error: null },
      'android.installSystemImage': { ok: true },
      ...overrides,
    },
  });
  return { ...view, onInstalled };
}

describe('when the package list cannot be fetched', () => {
  const failed = {
    'android.availableSystemImages': {
      images: [],
      error: 'sdkmanager needs a Java runtime and could not find one.',
    },
  };

  it('shows what actually went wrong, not a generic sentence', async () => {
    setup(failed);

    // One vague message for every failure is what made this impossible to act on.
    expect(await screen.findByText(/needs a Java runtime/i)).toBeInTheDocument();
  });

  it('offers a way to try again', async () => {
    setup(failed);

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('really asks again, rather than reading the cached failure', async () => {
    const { bridge, user } = setup(failed);

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    // The force flag is what skips the cache in the main process.
    await waitFor(() =>
      expect(bridge.$fn('android.availableSystemImages')).toHaveBeenCalledWith(true),
    );
  });

  it('shows the list once a retry works', async () => {
    let attempt = 0;
    const { user } = setup({
      'android.availableSystemImages': async () => {
        attempt += 1;
        return attempt === 1
          ? { images: [], error: 'network is down' }
          : { images: AVAILABLE, error: null };
      },
    });

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByLabelText(/image to download/i)).toBeInTheDocument();
    expect(screen.queryByText('network is down')).not.toBeInTheDocument();
  });
});

describe('when the list comes back empty but with no error', () => {
  it('says there is nothing to offer rather than blaming the connection', async () => {
    setup({ 'android.availableSystemImages': { images: [], error: null } });

    expect(await screen.findByText(/did not offer any/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('when the list arrives', () => {
  it('offers the images and the licence gate', async () => {
    setup();

    expect(await screen.findByLabelText(/image to download/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download and install/i })).toBeDisabled();
  });
});
