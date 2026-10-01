import type { DeployConnectionState } from '@shared/deployTypes';
import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { ConnectionBadge } from './ConnectionBadge';
import { useConnectionUpdates } from './hooks';
import { connection, SERVER } from './testing/fixtures';

/** The connection in a word everywhere on the Deploy page, and why in its tooltip. */

function Badge() {
  useConnectionUpdates();
  return <ConnectionBadge serverId={SERVER.id} />;
}

const CASES: Array<[DeployConnectionState, string, RegExp, object?]> = [
  ['online', 'Connected', /arrive as they happen/],
  ['connecting', 'Connecting', /Opening a live connection/],
  ['reconnecting', 'Reconnecting', /Trying again in \d+ s/, { retryAt: Date.now() + 4_000 }],
  ['offline', 'Not connected', /Opens by itself/],
  ['offline', 'Not connected', /not answering/, { message: 'The core is not answering.' }],
  ['needs-sign-in', 'Sign-in needed', /Sign in to the server core/],
  ['needs-re-enroll', 'Access to set up again', /set up on the server core again/],
  ['locked', 'Servers locked', /Unlock your saved servers/],
];

describe('ConnectionBadge', () => {
  it.each(CASES)('says %s as "%s" and explains it', async (state, label, why, extra) => {
    const { user } = renderWithProviders(<Badge />, {
      bridge: { 'deploy.connection': connection(state, extra) },
    });
    const badge = await screen.findByRole('status', { name: `Live connection: ${label}` });
    expect(badge).toHaveTextContent(label);
    await user.hover(badge);
    expect((await screen.findAllByText(why)).length).toBeGreaterThan(0);
  });

  it('says it is checking until the first answer, then follows every change', async () => {
    const { bridge } = renderWithProviders(<Badge />, {
      bridge: { 'deploy.connection': () => new Promise(() => undefined) },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Checking');
    act(() => bridge.$emit('deploy.onConnection', connection('reconnecting')));
    expect(
      await screen.findByRole('status', { name: 'Live connection: Reconnecting' }),
    ).toBeInTheDocument();
    act(() => bridge.$emit('deploy.onConnection', connection('online')));
    expect(
      await screen.findByRole('status', { name: 'Live connection: Connected' }),
    ).toBeInTheDocument();
  });

  it('explains itself before the first answer too', async () => {
    const { user } = renderWithProviders(<Badge />, {
      bridge: { 'deploy.connection': () => new Promise(() => undefined) },
    });
    await user.hover(screen.getByRole('status'));
    expect((await screen.findAllByText(/Checking the connection/)).length).toBeGreaterThan(0);
  });
});
