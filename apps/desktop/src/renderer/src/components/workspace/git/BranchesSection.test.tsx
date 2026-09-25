// @vitest-environment jsdom
import type { Project, WorktreeInfo } from '@agentmat/core';
import type { GitStatus, WorkspaceGitState } from '@shared/apiTypes';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asWorkspaceProject } from '@/lib/workspace/scope';
import { useWorktreeDialogStore } from '@/stores/worktreeDialogStore';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { BranchesSection } from './BranchesSection';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (original) => ({
  ...(await original<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

const project = { id: 'p1', name: 'App', folderPath: 'C:\\code\\app' } as Project;
const worktree = {
  id: 'wt-1',
  projectId: 'p1',
  path: 'C:\\code\\app.worktrees\\feat',
  branch: 'feat',
  baseBranch: 'main',
  createdAt: '2026-09-25T00:00:00.000Z',
  createdByApp: true,
  missing: false,
  locked: false,
  status: null,
} satisfies WorktreeInfo;

const state = {
  isRepo: true,
  branch: 'main',
  head: 'abc',
  hasRemote: false,
  staged: [],
  unstaged: [],
  untracked: [],
  conflicts: [],
} as unknown as WorkspaceGitState;

function status(branches: GitStatus['branches']): GitStatus {
  return { branches, defaultBranch: 'main' } as unknown as GitStatus;
}

beforeEach(() => {
  navigate.mockClear();
  useWorktreeDialogStore.setState({ create: null, remove: null });
});

describe('BranchesSection and worktrees', () => {
  const branches = [
    { name: 'dev', local: true, remote: false },
    { name: 'feat', local: true, remote: false, worktreePath: worktree.path },
    { name: 'main', local: true, remote: false },
  ];

  it('marks a branch another worktree has, and opens that worktree instead of checking out', async () => {
    const { bridge } = renderWithProviders(
      <BranchesSection
        project={project}
        state={state}
        creating={false}
        onCreatingChange={() => undefined}
      />,
      {
        bridge: {
          'git.status': status(branches),
          'worktrees.list': [worktree],
          'projects.list': [project],
        },
      },
    );
    expect(await screen.findByText('in worktree')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /feat/ }));
    expect(navigate).toHaveBeenCalledWith('/workspace/p1~wt-1');
    expect(() => bridge.$fn('git.checkoutBranch')).toThrow('has not been touched');
    expect(screen.queryByRole('button', { name: 'Delete feat' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete dev' })).toBeInTheDocument();
  });

  it('opens a free branch in a new worktree', async () => {
    renderWithProviders(
      <BranchesSection
        project={project}
        state={state}
        creating={false}
        onCreatingChange={() => undefined}
      />,
      {
        bridge: {
          'git.status': status(branches),
          'worktrees.list': [worktree],
          'projects.list': [project],
        },
      },
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Open dev in a new worktree' }));
    expect(useWorktreeDialogStore.getState().create).toEqual({
      projectId: 'p1',
      branch: 'dev',
      mode: 'existing',
    });
  });

  it('inside a worktree, points the main checkout’s branch back at it', async () => {
    const inTree = { ...state, branch: 'feat' } as WorkspaceGitState;
    renderWithProviders(
      <BranchesSection
        project={asWorkspaceProject(project, worktree)}
        state={inTree}
        creating={false}
        onCreatingChange={() => undefined}
      />,
      {
        bridge: {
          'git.status': status([
            { name: 'feat', local: true, remote: false },
            { name: 'main', local: true, remote: false, worktreePath: project.folderPath },
          ]),
          'worktrees.list': [worktree],
          'projects.list': [project],
        },
      },
    );
    expect(await screen.findByText('in main checkout')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /main/ }));
    expect(navigate).toHaveBeenCalledWith('/workspace/p1');
  });
});
