import type { PaneGroupNode, Project } from '@agentmat/core';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { PaneGroup } from './PaneGroup';

// The runtime owns real xterm instances, which have no place in jsdom. The session store that
// lives in the same module stays real, since the tabs read their status from it.
vi.mock('@/lib/terminal/terminalRuntime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/terminal/terminalRuntime')>();
  return {
    ...actual,
    terminalRuntime: {
      ...actual.terminalRuntime,
      mount: vi.fn(),
      unmount: vi.fn(),
      focus: vi.fn(),
    },
  };
});

const project = { id: 'p1', name: 'App', folderPath: 'C:\work\app' } as Project;

/** Reads the workspace from the store on every render, the way the pane tree does. */
function Harness(): React.JSX.Element | null {
  const workspace = useWorkspaceStore((s) => s.workspaces.p1);
  if (!workspace || workspace.root.type !== 'group') return null;
  return (
    <PaneGroup
      project={project}
      workspace={workspace}
      group={workspace.root as PaneGroupNode}
      multiPane={false}
    />
  );
}

beforeEach(() => {
  useWorkspaceStore.getState().openProject('p1');
  useWorkspaceStore.getState().addTerminal('p1', {
    title: 'Claude Code',
    cwd: 'C:\work\app',
    cliId: 'claude-code',
  });
  useWorkspaceStore.getState().openFile('p1', 'C:\work\app\src\index.ts');
});

describe('PaneGroup', () => {
  it('renders a file tab next to a terminal tab', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByRole('tab', { name: /Claude Code/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /index\.ts/ })).toBeInTheDocument();
  });

  it('marks an image tab with a picture icon, and a code file with a file icon', () => {
    // Both pinned, so the picture opens beside the code file instead of replacing the preview.
    useWorkspaceStore.getState().openFile('p1', 'C:\work\app\src\index.ts', { pin: true });
    useWorkspaceStore.getState().openFile('p1', 'C:\work\app\assets\logo.png', { pin: true });
    renderWithProviders(<Harness />);

    const imageTab = screen.getByRole('tab', { name: /logo\.png/ });
    expect(imageTab.querySelector('[data-icon="image"]')).toBeInTheDocument();
    const codeTab = screen.getByRole('tab', { name: /index\.ts/ });
    expect(codeTab.querySelector('[data-icon="file"]')).toBeInTheDocument();
  });

  it('opens the tab menu on a terminal tab', async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.pointer({
      target: screen.getByRole('tab', { name: /Claude Code/ }),
      keys: '[MouseRight]',
    });
    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
  });
});
