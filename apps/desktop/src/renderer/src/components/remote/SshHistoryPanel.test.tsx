import type { AgentHistorySession } from '@agentmat/core';
import type { SshConversationsResult, SshSavedServer } from '@shared/apiTypes';
import { screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { useTerminalStore } from '../../stores/terminalStore';

const openRemoteResume = vi.fn((..._args: unknown[]): string | null => 'tab-new');
vi.mock('@/lib/workspace/launch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/workspace/launch')>()),
  openRemoteResume: (...args: unknown[]) => openRemoteResume(...args),
}));

const { SshHistoryPanel } = await import('./SshHistoryPanel');

/**
 * The history panel lists what Claude Code and Codex left on a saved server, by folder, and
 * picks a conversation back up in an SSH tab. It talks to the server only when opened or
 * refreshed, never on a timer.
 */

const server: SshSavedServer = {
  id: 'srv-1',
  nickname: 'prod',
  host: 'prod.example',
  port: 22,
  username: 'dev',
  authMethod: 'password',
  hasSecret: true,
  createdAt: 0,
  lastConnectedAt: null,
};

const HOUR = 60 * 60 * 1000;

function session(overrides: Partial<AgentHistorySession>): AgentHistorySession {
  return {
    provider: 'claude-code',
    id: 'conv-x',
    title: null,
    firstPrompt: null,
    lastPrompt: null,
    cwd: '/home/dev/code/app',
    gitBranch: null,
    model: null,
    effort: null,
    startedAt: null,
    updatedAt: Date.now() - HOUR,
    sizeBytes: 100,
    background: false,
    ...overrides,
  };
}

const appNewest = session({ id: 'conv-app-1', title: 'Fix the login flow', updatedAt: Date.now() });
const appOlder = session({
  id: 'conv-app-2',
  title: 'Add rate limiting',
  updatedAt: Date.now() - 2 * HOUR,
});
const apiOnly = session({
  provider: 'codex',
  id: 'conv-api-1',
  title: 'Migrate the api schema',
  cwd: '/home/dev/code/api',
  updatedAt: Date.now() - 3 * HOUR,
});
const nowhere = session({
  id: 'conv-none-1',
  title: 'Somewhere unknown',
  cwd: null,
  updatedAt: Date.now() - 4 * HOUR,
});

function result(overrides: Partial<SshConversationsResult> = {}): SshConversationsResult {
  return {
    sessions: [appNewest, appOlder, apiOnly, nowhere],
    home: '/home/dev',
    clis: { claude: true, codex: true },
    ...overrides,
  };
}

function renderPanel(answer: unknown = result()) {
  const onOpenChange = vi.fn();
  const view = renderWithProviders(
    <SshHistoryPanel server={server} onOpenChange={onOpenChange} onRequestUnlock={vi.fn()} />,
    { bridge: { 'ssh.conversations': answer } },
  );
  return { ...view, onOpenChange };
}

function folderButton(path: RegExp): HTMLElement {
  return screen.getByRole('button', { name: path });
}

beforeEach(() => {
  openRemoteResume.mockClear();
  openRemoteResume.mockImplementation(() => 'tab-new');
});

describe('SshHistoryPanel', () => {
  it('names the server and shimmers while it connects, with search focused', () => {
    renderPanel(() => new Promise(() => undefined));

    const dialog = screen.getByRole('dialog', { name: 'prod' });
    expect(dialog).toHaveTextContent('dev@prod.example');
    expect(screen.getByText('Connecting to prod…')).toBeInTheDocument();
    expect(dialog.querySelector('.shimmer')).not.toBeNull();
    expect(screen.getByRole('textbox', { name: 'Search conversations' })).toHaveFocus();
  });

  it('shows a readable error and tries again on Retry', async () => {
    const conversations = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Error invoking remote method 'ssh:conversations': Error: Connection refused"),
      )
      .mockResolvedValue(result());
    const { user } = renderPanel(conversations);

    expect(await screen.findByText('Connection refused')).toBeInTheDocument();
    expect(screen.queryByText(/Error invoking remote method/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Fix the login flow')).toBeInTheDocument();
    expect(conversations).toHaveBeenCalledTimes(2);
  });

  it('explains where conversations come from when the server has none', async () => {
    renderPanel(result({ sessions: [] }));

    expect(
      await screen.findByText('No Claude Code or Codex conversations on this server yet.'),
    ).toBeInTheDocument();
  });

  it('groups by folder, home shortened to ~, newest folder open and the rest folded', async () => {
    const { user } = renderPanel();

    await screen.findByText('Fix the login flow');
    expect(screen.getByRole('dialog', { name: 'prod' })).toHaveTextContent(
      '4 conversations · 3 folders',
    );

    const app = folderButton(/~\/code\/app/);
    const api = folderButton(/~\/code\/api/);
    const unknown = folderButton(/Unknown folder/);
    expect(app).toHaveAttribute('aria-expanded', 'true');
    expect(app).toHaveAccessibleName(/2 conversations/);
    expect(api).toHaveAttribute('aria-expanded', 'false');
    expect(unknown).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Add rate limiting')).toBeInTheDocument();
    expect(screen.queryByText('Migrate the api schema')).not.toBeInTheDocument();

    await user.click(api);
    expect(api).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Migrate the api schema')).toBeInTheDocument();

    await user.click(app);
    expect(app).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Fix the login flow')).not.toBeInTheDocument();
  });

  it('filters by search and opens every folder that still matches', async () => {
    const { user } = renderPanel();
    await screen.findByText('Fix the login flow');

    await user.type(screen.getByRole('textbox', { name: 'Search conversations' }), 'schema');

    expect(folderButton(/~\/code\/api/)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Migrate the api schema')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /~\/code\/app/ })).not.toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'Search conversations' }));
    await user.type(screen.getByRole('textbox', { name: 'Search conversations' }), 'zzz');
    expect(screen.getByText('No conversation matches.')).toBeInTheDocument();
  });

  it('resumes a conversation in a new SSH tab and gets out of the way', async () => {
    const success = vi.spyOn(toast, 'success');
    const { user, onOpenChange } = renderPanel();

    await user.click(await screen.findByText('Fix the login flow'));

    expect(openRemoteResume).toHaveBeenCalledWith(server, appNewest);
    expect(success).toHaveBeenCalledWith('Resuming in a new SSH tab');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    success.mockRestore();
  });

  it('stays open and quiet when the resume could not start', async () => {
    openRemoteResume.mockImplementation(() => null);
    const success = vi.spyOn(toast, 'success');
    const { user, onOpenChange } = renderPanel();

    await user.click(await screen.findByText('Fix the login flow'));

    expect(success).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    success.mockRestore();
  });

  it('warns about a CLI a login shell could not find, but still lets it resume', async () => {
    // The probe runs in a login shell; a PATH set only in .bashrc still works for the resume.
    const { user } = renderPanel(
      result({ sessions: [apiOnly], clis: { claude: false, codex: false } }),
    );

    await screen.findByText('Migrate the api schema');
    // The command sits in its own monospace span, so match the chip by its whole text.
    const chipWith = (text: string) => (_: string, el: Element | null) =>
      el?.hasAttribute('tabindex') === true && el.textContent === text;
    const chip = screen.getByText(chipWith('codex not found on PATH'));
    expect(screen.queryByText(chipWith('claude not found on PATH'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume in a new tab' })).toBeEnabled();

    await user.hover(chip);
    expect(
      await screen.findAllByText(/couldn't find the codex command in a login shell/),
    ).not.toHaveLength(0);

    await user.click(screen.getByText('Migrate the api schema'));
    expect(openRemoteResume).toHaveBeenCalledWith(server, apiOnly);
  });

  it('offers to unlock the vault when it got locked, instead of a raw error', async () => {
    const onRequestUnlock = vi.fn();
    const { user } = renderWithProviders(
      <SshHistoryPanel server={server} onOpenChange={vi.fn()} onRequestUnlock={onRequestUnlock} />,
      {
        bridge: {
          'ssh.conversations': async () => {
            throw new Error(
              "Error invoking remote method 'ssh:conversations': Error: [ssh:vault-locked] The Servers vault is locked.",
            );
          },
        },
      },
    );

    expect(await screen.findByText('The servers vault is locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(onRequestUnlock).toHaveBeenCalledTimes(1);
  });

  it('marks a conversation already open in a tab and goes back to it', async () => {
    useTerminalStore.setState({
      sessions: [
        {
          id: 'tab-open',
          title: 'prod',
          kind: 'ssh',
          sshServerId: server.id,
          conversationId: appNewest.id,
        },
      ],
    });
    openRemoteResume.mockImplementation(() => 'tab-open');
    const success = vi.spyOn(toast, 'success');
    const { user, onOpenChange } = renderPanel(
      result({ sessions: [appNewest], clis: { claude: false, codex: true } }),
    );

    const row = (await screen.findByText('Fix the login flow')).closest('button');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Open')).toBeInTheDocument();
    expect(row).not.toHaveAttribute('aria-disabled');

    await user.click(row as HTMLElement);

    expect(openRemoteResume).toHaveBeenCalledWith(server, appNewest);
    expect(success).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    success.mockRestore();
  });

  it('asks the server once, not on a timer', async () => {
    const { bridge } = renderPanel();

    await screen.findByText('Fix the login flow');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(bridge.$fn('ssh.conversations')).toHaveBeenCalledTimes(1);
    expect(bridge.$fn('ssh.conversations')).toHaveBeenCalledWith(server.id);
  });

  it('refreshes on demand', async () => {
    const { user, bridge } = renderPanel();
    await screen.findByText('Fix the login flow');

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(bridge.$fn('ssh.conversations')).toHaveBeenCalledTimes(2));
  });

  it('closes on Escape', async () => {
    const { user, onOpenChange } = renderPanel();
    await screen.findByText('Fix the login flow');

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
