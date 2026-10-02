import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDeployAssistantStore } from '@/stores/deployAssistantStore';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { dockerBridge, SERVER } from '../containers/testing/fixtures';
import { LogsPanel } from './LogsPanel';

/**
 * The Logs section: the problems feed first, then the viewer, whose "Ask the AI" opens the drawer
 * on what it shows, and whose site logs replace what they show when the core starts over.
 */

function bridge() {
  return {
    ...dockerBridge(['admin']),
    'deployStacks.list': [],
    'deployCerts.list': [],
    'deployFirewall.exposure': {
      sockets: [],
      containers: [],
      dockerAvailable: true,
      collectedAtUnixMs: 0,
    },
    'deployAlerts.list': [],
    'deployAlerts.watch': async () => 'alerts-1',
    'deployAlerts.unwatch': async () => true,
    'deploySites.list': [
      { settings: { id: 'blog', domains: ['blog.example.com'] }, applied: true },
    ],
    'deploySites.watchLog': async () => 'site-1',
    'deploySites.unwatchLog': async () => true,
    'deployLogs.watchJournal': async () => 'j-1',
    'deployLogs.unwatchJournal': async () => true,
  };
}

beforeEach(() => {
  useDeployAssistantStore.setState({ openServerId: null, draft: null, runs: {} });
});

describe('LogsPanel', () => {
  it('starts on the problems and opens the AI on a journal from the viewer', async () => {
    const { user } = renderWithProviders(<LogsPanel server={SERVER} />, { bridge: bridge() });
    expect(await screen.findByText('Nothing needs attention right now.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Log viewer' }));
    await user.click(await screen.findByRole('button', { name: 'Ask the AI' }));
    expect(useDeployAssistantStore.getState().draft).toMatchObject({
      serverId: SERVER.id,
      context: {
        title: 'Logs: docker.service',
        facts: [expect.stringContaining('journalctl -u docker.service')],
      },
    });
  });

  it('shows a site log and starts over on a reset', async () => {
    const { user, bridge: fake } = renderWithProviders(<LogsPanel server={SERVER} />, {
      bridge: bridge(),
    });
    await user.click(screen.getByRole('tab', { name: 'Log viewer' }));
    await user.click(await screen.findByLabelText('Log source'));
    await user.click(
      await screen.findByRole('option', { name: 'Site blog.example.com: access log' }),
    );
    await waitFor(() => expect(fake.$fn('deploySites.watchLog')).toHaveBeenCalled());
    const event = (lines: string[], reset: boolean) => ({
      subscriptionId: 'site-1',
      serverId: SERVER.id,
      siteId: 'blog',
      kind: 'access',
      lines,
      reset,
    });
    act(() => fake.$emit('deploySites.onLog', event(['"GET / HTTP/1.1" 200 1 '], false)));
    const log = screen.getByRole('log', { name: 'Log: blog.example.com access log' });
    expect(await within(log).findByText(/GET \//)).toBeInTheDocument();
    act(() => fake.$emit('deploySites.onLog', event(['"GET /new HTTP/1.1" 502 1 '], true)));
    await waitFor(() => expect(within(log).queryByText(/GET \/ HTTP/)).not.toBeInTheDocument());
    expect(log.querySelector('[data-level="error"]')).toHaveTextContent('GET /new');
    act(() =>
      fake.$emit('deploySites.onLog', {
        ...event([], false),
        ended: { error: 'The site is gone.' },
      }),
    );
    expect(await screen.findByText('The site is gone.')).toBeInTheDocument();
  });
});
