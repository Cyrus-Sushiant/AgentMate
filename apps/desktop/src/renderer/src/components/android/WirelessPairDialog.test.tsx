import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { WirelessPairDialog } from './WirelessPairDialog';

/**
 * The pairing flow. The port the phone shows for pairing is not the port adb connects on, which
 * is the mistake everyone makes, so the dialog has to carry the user across that gap itself.
 */

function setup(overrides: Record<string, unknown> = {}) {
  return renderWithProviders(<WirelessPairDialog open onOpenChange={vi.fn()} />, {
    bridge: { 'android.pair': { ok: true }, 'android.connect': { ok: true }, ...overrides },
  });
}

describe('WirelessPairDialog', () => {
  it('sends the address and code the phone showed', async () => {
    const { user, bridge } = setup();

    await user.type(screen.getByLabelText('Address and port'), '192.168.1.20:37105');
    await user.type(screen.getByLabelText('Pairing code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Pair' }));

    await waitFor(() =>
      expect(bridge.$fn('android.pair')).toHaveBeenCalledWith('192.168.1.20:37105', '123456'),
    );
  });

  it('moves to Connect with the same host but the normal debugging port', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText('Address and port'), '192.168.1.20:37105');
    await user.type(screen.getByLabelText('Pairing code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Pair' }));

    // 37105 was the one-time pairing port; connecting happens on 5555.
    const connectField = await screen.findByLabelText('Address and port');
    await waitFor(() => expect(connectField).toHaveValue('192.168.1.20:5555'));
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('shows a pairing failure inline, so the code can be retyped on the spot', async () => {
    const { user } = setup({ 'android.pair': { ok: false, message: 'Wrong password' } });

    await user.type(screen.getByLabelText('Address and port'), '192.168.1.20:37105');
    await user.type(screen.getByLabelText('Pairing code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Pair' }));

    expect(await screen.findByText('Wrong password')).toBeInTheDocument();
    // Still on the pairing step, with what was typed still there.
    expect(screen.getByRole('button', { name: 'Pair' })).toBeInTheDocument();
  });

  it('connects once paired', async () => {
    const { user, bridge } = setup();

    await user.type(screen.getByLabelText('Address and port'), '192.168.1.20:37105');
    await user.type(screen.getByLabelText('Pairing code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Pair' }));
    await screen.findByRole('button', { name: 'Connect' });
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(bridge.$fn('android.connect')).toHaveBeenCalledWith('192.168.1.20:5555'),
    );
  });
});
