import type { Project } from '@agentmat/core';
import type { WorkspaceGitState } from '@shared/apiTypes';
import { act, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { GitPanel } from './GitPanel';

/**
 * The Conflicts section as the panel builds it: only a conflicted row gets "Resolve with AI",
 * and while the AI is writing that file it can't be marked resolved (which would stage a half
 * edit), while other conflicted files carry on as normal.
 */

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

const project = { id: 'p1', name: 'App', folderPath: 'E:\\work\\app', cliId: 'claude' } as Project;

const state = {
  isRepo: true,
  branch: 'main',
  detached: false,
  head: 'abc1234',
  upstream: null,
  ahead: 0,
  behind: 0,
  hasRemote: false,
  operation: 'merge',
  conflicts: [
    { path: 'src/app.ts', status: 'U', conflict: 'UU' },
    { path: 'src/other.ts', status: 'U', conflict: 'UU' },
  ],
  staged: [],
  unstaged: [{ path: 'README.md', status: 'M' }],
  untracked: [],
  untrackedTruncated: false,
  projectPrefix: '',
} as WorkspaceGitState;

function renderPanel(run: (...args: unknown[]) => Promise<unknown>) {
  return renderWithProviders(<GitPanel project={project} visible />, {
    bridge: {
      'git.workspaceState': state,
      'git.status': { branches: [], defaultBranch: 'main' },
      'git.resolveConflictWithAi': run,
      'settings.get': { reviewCommands: [] },
    },
  });
}

const row = (name: RegExp) => screen.getByRole('option', { name });

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.getState().revealPanelSection('changes');
});

describe('GitPanel conflicts with AI', () => {
  it('gives only conflicted rows the AI action', async () => {
    renderPanel(vi.fn());
    await screen.findByRole('option', { name: /^src\/app\.ts/ });

    expect(
      within(row(/^src\/app\.ts/)).getByRole('button', { name: 'Resolve with AI' }),
    ).toBeInTheDocument();
    expect(
      within(row(/^README\.md/)).queryByRole('button', { name: 'Resolve with AI' }),
    ).not.toBeInTheDocument();
  });

  it('holds off marking a file resolved while the AI writes it, and only that file', async () => {
    let finish: (answer: unknown) => void = () => undefined;
    const run = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = renderPanel(run);
    await screen.findByRole('option', { name: /^src\/app\.ts/ });

    await user.click(within(row(/^src\/app\.ts/)).getByRole('button', { name: 'Resolve with AI' }));

    expect(run).toHaveBeenCalledWith('p1', 'src/app.ts', expect.any(String));
    const busy = row(/^src\/app\.ts/);
    expect(
      within(busy).getByRole('button', { name: 'Stop resolving with AI' }),
    ).toBeInTheDocument();
    expect(
      within(busy).queryByRole('button', { name: 'Mark as resolved' }),
    ).not.toBeInTheDocument();
    expect(
      within(row(/^src\/other\.ts/)).getByRole('button', { name: 'Mark as resolved' }),
    ).toBeInTheDocument();

    await act(async () => {
      finish({ ok: false, cancelled: true, message: '' });
    });
    expect(
      await within(row(/^src\/app\.ts/)).findByRole('button', { name: 'Mark as resolved' }),
    ).toBeInTheDocument();
  });
});
