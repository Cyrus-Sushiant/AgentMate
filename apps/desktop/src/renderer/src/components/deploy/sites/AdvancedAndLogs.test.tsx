import type { DeploySiteLogEvent } from '@shared/deploySitesTypes';
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { SERVER, site, sitesBridge } from './testing/fixtures';

/**
 * Custom directives (Owner only, shown as a diff, refused lines marked) and the live site logs
 * (new lines, a rotated file, a log that ended).
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
);
vi.mock('sonner', () => ({ toast }));
vi.mock('@/components/editor/MonacoEditor', async () => ({
  MonacoEditor: (await import('./testing/monacoMocks')).FakeMonacoEditor,
}));
vi.mock('@/components/editor/MonacoDiffEditor', async () => ({
  MonacoDiffEditor: (await import('./testing/monacoMocks')).FakeMonacoDiffEditor,
}));

const { AdvancedTab } = await import('./AdvancedTab');
const { LogsTab } = await import('./LogsTab');

describe('AdvancedTab', () => {
  it('waits for the site to be saved', () => {
    renderWithProviders(
      <AdvancedTab
        serverId={SERVER.id}
        site={undefined}
        owner
        applyProblems={[]}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText(/Save the site first/)).toBeInTheDocument();
  });

  it('shows the change as a diff, then marks what the core refused by line', async () => {
    const onSaved = vi.fn();
    const saved = site({ locationSnippet: 'proxy_buffering off;' });
    let calls = 0;
    const { user, bridge } = renderWithProviders(
      <AdvancedTab serverId={SERVER.id} site={site()} owner applyProblems={[]} onSaved={onSaved} />,
      {
        bridge: {
          ...sitesBridge(),
          'deploySites.setSnippets': async () => {
            calls += 1;
            return calls === 1
              ? {
                  problems: [
                    {
                      field: 'sites[blog].locationSnippet',
                      message: 'include is not allowed.',
                      line: 2,
                    },
                    { field: 'sites[blog].serverSnippet', message: 'Too long.' },
                  ],
                }
              : { problems: [], site: saved };
          },
        },
      },
    );
    const review = screen.getByRole('button', { name: /Review the change/ });
    expect(review).toBeDisabled();
    const [, location] = screen.getAllByRole('textbox', { name: 'Snippet editor' });
    await user.type(location, 'proxy_buffering off;');
    await user.click(review);
    const dialog = await screen.findByRole('dialog', { name: 'Save these directives?' });
    expect(within(dialog).getByTestId('snippet-diff')).toHaveTextContent('=> proxy_buffering off;');
    await user.click(within(dialog).getByRole('button', { name: /Save directives/ }));
    expect(bridge.$fn('deploySites.setSnippets')).toHaveBeenCalledWith(SERVER.id, {
      siteId: 'blog',
      locationSnippet: 'proxy_buffering off;',
    });
    expect(await screen.findByText('Line 2: include is not allowed.')).toBeInTheDocument();
    expect(screen.getAllByTestId('marks')[1]).toHaveTextContent('2:include is not allowed.');
    expect(screen.getByText('Line 1: Too long.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Review the change/ }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /Save directives/ }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(toast.success).toHaveBeenCalledWith('Custom directives saved. Apply to put them live.');
  });

  it('marks what the last apply refused, and says when saving failed', async () => {
    const { user } = renderWithProviders(
      <AdvancedTab
        serverId={SERVER.id}
        site={site({ serverSnippet: 'a;' })}
        owner
        applyProblems={[{ field: 'sites[blog].hsts', message: 'Other problem.' }]}
        onSaved={vi.fn()}
      />,
      {
        bridge: {
          ...sitesBridge(),
          'deploySites.setSnippets': () => Promise.reject(new Error('Owner only.')),
        },
      },
    );
    expect(screen.getByText('Other problem.')).toBeInTheDocument();
    const [server] = screen.getAllByRole('textbox', { name: 'Snippet editor' });
    await user.clear(server);
    await user.click(screen.getByRole('button', { name: /Review the change/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Save directives/ }));
    expect(await within(dialog).findByText('Owner only.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

function event(lines: string[], extra: Partial<DeploySiteLogEvent> = {}): DeploySiteLogEvent {
  return {
    subscriptionId: 'log-1',
    serverId: SERVER.id,
    siteId: 'blog',
    kind: 'access',
    lines,
    reset: false,
    ...extra,
  };
}

describe('LogsTab', () => {
  it('follows the access log, starts over when the file is rotated, and switches logs', async () => {
    const { bridge, user } = renderWithProviders(<LogsTab serverId={SERVER.id} siteId="blog" />, {
      bridge: sitesBridge(),
    });
    expect(screen.getByText(/Waiting for requests/)).toBeInTheDocument();
    await waitFor(() =>
      expect(bridge.$fn('deploySites.watchLog')).toHaveBeenCalledWith({
        serverId: SERVER.id,
        siteId: 'blog',
        kind: 'access',
      }),
    );
    await act(async () => bridge.$emit('deploySites.onLog', event(['GET / 200', 'GET /a 404'])));
    const log = screen.getByRole('log', { name: 'Access log' });
    expect(within(log).getByText('GET /a 404')).toBeInTheDocument();
    expect(screen.getByText('Following live')).toBeInTheDocument();

    await act(async () => bridge.$emit('deploySites.onLog', event(['fresh'], { reset: true })));
    expect(within(log).queryByText('GET / 200')).toBeNull();
    expect(screen.getByText(/The log was rotated once/)).toBeInTheDocument();
    await act(async () => bridge.$emit('deploySites.onLog', event([], { reset: true })));
    expect(screen.getByText(/rotated 2 times/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Keep scrolled/ }));

    await user.click(screen.getByRole('button', { name: 'Error log' }));
    expect(await screen.findByRole('log', { name: 'Error log' })).toBeInTheDocument();
    await waitFor(() => expect(bridge.$fn('deploySites.unwatchLog')).toHaveBeenCalledWith('log-1'));
    await act(async () =>
      bridge.$emit(
        'deploySites.onLog',
        event(['2026/10/02 [error] upstream refused', '2026/10/02 [warn] slow'], { kind: 'error' }),
      ),
    );
    expect(screen.getByText(/upstream refused/)).toHaveClass('text-destructive');
    expect(screen.getByText(/slow/)).toHaveClass('text-warning');
  });

  it('says when the log stopped and why', async () => {
    const { bridge } = renderWithProviders(<LogsTab serverId={SERVER.id} siteId="blog" />, {
      bridge: sitesBridge(),
    });
    await waitFor(() => expect(bridge.$fn('deploySites.watchLog')).toHaveBeenCalled());
    await act(async () =>
      bridge.$emit('deploySites.onLog', event([], { ended: { error: 'There is no such site.' } })),
    );
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.getByText('Nothing to show.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('There is no such site.');
  });

  it('says when the log could not start', async () => {
    renderWithProviders(<LogsTab serverId={SERVER.id} siteId="blog" />, {
      bridge: {
        ...sitesBridge(),
        'deploySites.watchLog': () => Promise.reject(new Error('Two site logs are already open.')),
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Two site logs are already open.');
  });
});
