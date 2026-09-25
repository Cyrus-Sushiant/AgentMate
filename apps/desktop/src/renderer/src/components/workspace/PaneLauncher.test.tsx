// @vitest-environment jsdom
import type { Project, WorktreeInfo } from '@agentmat/core';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { asWorkspaceProject } from '@/lib/workspace/scope';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { PaneLauncher } from './PaneLauncher';

const project = { id: 'p1', name: 'App', folderPath: 'C:\\code\\app', cliId: null } as Project;
const worktree = {
  id: 'wt-1',
  projectId: 'p1',
  path: 'C:\\code\\app.worktrees\\feat-auth',
  branch: 'feat/auth',
  baseBranch: 'main',
  createdAt: '2026-09-25T00:00:00.000Z',
  createdByApp: true,
  missing: false,
  locked: false,
  status: null,
} satisfies WorktreeInfo;

describe('PaneLauncher in a worktree', () => {
  it('says which worktree an agent started here would work in', () => {
    renderWithProviders(
      <PaneLauncher
        project={asWorkspaceProject(project, worktree)}
        groupId="g1"
        hero
        focused={false}
      />,
      { bridge: { 'cli.detectAll': [], platform: 'win32' } },
    );
    expect(screen.getByText('Worktree')).toBeInTheDocument();
    expect(screen.getByText('feat/auth')).toBeInTheDocument();
    expect(screen.getByText(worktree.path)).toBeInTheDocument();
  });

  it('shows no branch for the main checkout', () => {
    renderWithProviders(<PaneLauncher project={project} groupId="g1" hero focused={false} />, {
      bridge: { 'cli.detectAll': [], platform: 'win32' },
    });
    expect(screen.queryByText('Worktree')).toBeNull();
  });
});
