// @vitest-environment jsdom
import type { GitChangeEntry, Project } from '@agentmat/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useExplorerStore } from '@/stores/explorerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import {
  type FakeBridge,
  installAgentmatBridge,
} from '../../../../../test/renderer/agentmatBridge';
import { GitFileRow } from './GitFileRow';

const project = { id: 'p1', name: 'App', folderPath: 'E:\\work\\app' } as Project;

let bridge: FakeBridge;

function renderRow(
  entry: GitChangeEntry,
  handlers: { onOpen?: (pin: boolean) => void; onOpenFile?: () => void } = {},
) {
  return render(
    <TooltipProvider>
      <GitFileRow
        project={project}
        projectPrefix=""
        entry={entry}
        side="unstaged"
        selected={false}
        focusable
        onFocusRow={vi.fn()}
        onOpen={handlers.onOpen ?? vi.fn()}
        onOpenFile={handlers.onOpenFile ?? vi.fn()}
        onStage={vi.fn()}
        onDiscard={vi.fn()}
      />
    </TooltipProvider>,
  );
}

function openMenu(): void {
  fireEvent.contextMenu(screen.getByRole('option'));
}

beforeEach(() => {
  bridge = installAgentmatBridge({ platform: 'win32' });
  useExplorerStore.setState({ projects: {} });
  useWorkspaceStore.getState().setGitPanel({ activeSection: 'sourceControl' });
});

afterEach(cleanup);

describe('GitFileRow menu', () => {
  const entry = { path: 'src/app/page.tsx', status: 'M' } as GitChangeEntry;

  it('opens the file itself, not its diff', () => {
    const onOpen = vi.fn();
    const onOpenFile = vi.fn();
    renderRow(entry, { onOpen, onOpenFile });
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open File' }));
    expect(onOpenFile).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('reveals the file on disk and in the default app', () => {
    renderRow(entry);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reveal in File Explorer' }));
    expect(bridge.$fn('explorer.revealInOs')).toHaveBeenCalledWith(
      'p1',
      'E:\\work\\app\\src\\app\\page.tsx',
    );

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open With Default App' }));
    expect(bridge.$fn('shell.openPath')).toHaveBeenCalledWith('E:\\work\\app\\src\\app\\page.tsx');
  });

  it('switches to the explorer and selects the file there', () => {
    renderRow(entry);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reveal in Explorer View' }));
    expect(useWorkspaceStore.getState().gitPanel.activeSection).toBe('explorer');
    const tree = useExplorerStore.getState().projects.p1;
    expect(tree?.selected).toEqual(['E:\\work\\app\\src\\app\\page.tsx']);
    expect(tree?.open['E:\\work\\app\\src\\app']).toBe(true);
    expect(tree?.open['E:\\work\\app\\src']).toBe(true);
  });

  it('keeps a deleted file out of the actions that need it on disk', () => {
    renderRow({ ...entry, status: 'D' } as GitChangeEntry);
    openMenu();
    for (const name of [
      'Open File',
      'Open With Default App',
      'Reveal in File Explorer',
      'Reveal in Explorer View',
    ]) {
      expect(screen.getByRole('menuitem', { name })).toHaveAttribute('data-disabled');
    }
    expect(screen.getByRole('menuitem', { name: 'Copy Path' })).not.toHaveAttribute(
      'data-disabled',
    );
  });
});
