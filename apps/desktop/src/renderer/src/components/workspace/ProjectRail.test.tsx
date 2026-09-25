// @vitest-environment jsdom
import type { Project, WorktreeInfo } from '@agentmat/core';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useWorktreeDialogStore } from '@/stores/worktreeDialogStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { ProjectRail } from './ProjectRail';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (original) => ({
  ...(await original<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));
vi.mock('@/lib/terminal/terminalRuntime', () => ({
  terminalRuntime: { dispose: vi.fn() },
  useTerminalSessionStore: Object.assign(
    (select: (state: { ended: Record<string, number> }) => unknown) => select({ ended: {} }),
    { getState: () => ({ ended: {} }) },
  ),
}));

const project = {
  id: 'p1',
  name: 'AgentMate',
  folderPath: 'C:\\code\\app',
  iconDataUrl: null,
  iconBgColor: null,
  iconColor: null,
  archived: false,
} as unknown as Project;

function worktree(id: string, branch: string, patch: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    id,
    projectId: 'p1',
    path: `C:\\code\\app.worktrees\\${branch.replaceAll('/', '-')}`,
    branch,
    baseBranch: 'main',
    createdAt: '2026-09-25T00:00:00.000Z',
    createdByApp: true,
    missing: false,
    locked: false,
    status: { changes: 2, ahead: 1, behind: 0, merged: false, unpushed: null },
    ...patch,
  };
}

const trees = [worktree('wt-1', 'feat/auth-flow'), worktree('wt-2', 'fix-login')];

function renderRail(active: string | null = 'p1', list: WorktreeInfo[] = trees) {
  return renderWithProviders(<ProjectRail projects={[project]} activeProjectId={active} />, {
    bridge: { 'worktrees.list': list },
  });
}

beforeEach(() => {
  navigate.mockClear();
  useWorkspaceStore.setState({
    workspaces: {},
    railProjectIds: ['p1'],
    activeProjectId: 'p1',
    railExpanded: {},
  });
  useWorktreeDialogStore.setState({ create: null, remove: null });
});

describe('worktrees in the rail', () => {
  it('shows each worktree under its project, with letters from the branch', async () => {
    renderRail();
    const auth = await screen.findByRole('button', { name: 'Open worktree feat/auth-flow' });
    expect(auth).toHaveTextContent('AF');
    expect(screen.getByRole('button', { name: 'Open worktree fix-login' })).toHaveTextContent('FL');
  });

  it('opens a worktree’s workspace', async () => {
    renderRail();
    fireEvent.click(await screen.findByRole('button', { name: 'Open worktree fix-login' }));
    expect(navigate).toHaveBeenCalledWith('/workspace/p1~wt-2');
  });

  it('marks the worktree on screen, and only it', async () => {
    renderRail('p1~wt-1');
    expect(
      await screen.findByRole('button', { name: 'Open worktree feat/auth-flow' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Open AgentMate' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('folds the worktrees away behind a count, and back', async () => {
    renderRail();
    await screen.findByRole('button', { name: 'Open worktree fix-login' });
    fireEvent.click(screen.getByRole('button', { name: 'Hide AgentMate worktrees' }));
    expect(screen.queryByRole('button', { name: 'Open worktree fix-login' })).toBeNull();
    expect(useWorkspaceStore.getState().railExpanded.p1).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 AgentMate worktrees' }));
    expect(screen.getByRole('button', { name: 'Open worktree fix-login' })).toBeInTheDocument();
  });

  it('keeps a folded project’s active worktree in view', async () => {
    useWorkspaceStore.setState({ railExpanded: { p1: false } });
    renderRail('p1~wt-2');
    expect(
      await screen.findByRole('button', { name: 'Open worktree fix-login' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open worktree feat/auth-flow' })).toBeNull();
  });

  it('starts a new worktree from the rail', async () => {
    renderRail();
    fireEvent.click(await screen.findByRole('button', { name: 'New AgentMate worktree' }));
    expect(useWorktreeDialogStore.getState().create).toEqual({ projectId: 'p1' });
  });

  it('offers a new worktree on the project tile’s menu, even with none yet', async () => {
    renderRail('p1', []);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Open AgentMate' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /New worktree/ }));
    expect(useWorktreeDialogStore.getState().create).toEqual({ projectId: 'p1' });
  });

  it('flags a worktree whose folder is gone', async () => {
    renderRail('p1', [worktree('wt-1', 'feat/x', { missing: true, status: null })]);
    const tile = await screen.findByRole('button', {
      name: 'Open worktree feat/x (folder missing)',
    });
    expect(tile).toBeInTheDocument();
  });

  it('lists what can be done with a worktree on right-click', async () => {
    renderRail();
    fireEvent.contextMenu(await screen.findByRole('button', { name: 'Open worktree fix-login' }));
    const menu = await screen.findByRole('menu');
    for (const name of [
      'New agent here',
      'Merge into main',
      'Create pull request',
      'Remove worktree…',
    ]) {
      expect(within(menu).getByRole('menuitem', { name: new RegExp(name) })).toBeInTheDocument();
    }
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Remove worktree/ }));
    await waitFor(() =>
      expect(useWorktreeDialogStore.getState().remove).toEqual({
        projectId: 'p1',
        worktreeId: 'wt-2',
      }),
    );
  });
});
