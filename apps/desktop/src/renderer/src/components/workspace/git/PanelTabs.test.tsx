// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Flask, FolderTree, GitBranch } from '@/components/icons';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { type PanelTabDef, PanelTabs } from './PanelTabs';

/**
 * The project panel's tab strip: icon tabs on a sliding pill, a count inside the tab it belongs
 * to, arrow keys between tabs, and a toolbar row of its own for a tab with many buttons.
 */

const tabs: PanelTabDef[] = [
  {
    id: 'sourceControl',
    title: 'Source control',
    icon: GitBranch,
    count: 3,
    render: () => <p>changes body</p>,
  },
  {
    id: 'explorer',
    title: 'Explorer',
    icon: FolderTree,
    actions: <button type="button">Refresh files</button>,
    render: () => <p>files body</p>,
  },
  {
    id: 'tests',
    title: 'Tests',
    icon: Flask,
    count: 2,
    countTone: 'destructive',
    toolbarTitle: 'Tests',
    actions: <button type="button">Run all tests</button>,
    render: () => <p>tests body</p>,
  },
];

function renderTabs(): void {
  render(
    <TooltipProvider>
      <PanelTabs tabs={tabs} />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  useWorkspaceStore.getState().setGitPanel({ activeSection: 'sourceControl' });
});
afterEach(cleanup);

describe('PanelTabs', () => {
  it('shows only the open tab and marks it selected', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: 'Source control' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('changes body');
    expect(screen.queryByText('files body')).toBeNull();
  });

  it('keeps each count inside its own tab, red when it counts failures', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: 'Source control' })).toHaveTextContent('3');
    const failing = within(screen.getByRole('tab', { name: 'Tests' })).getByText('2');
    expect(failing.className).toContain('text-destructive');
  });

  it('moves between tabs with the arrow keys, wrapping at the ends', () => {
    renderTabs();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Source control' }), { key: 'ArrowLeft' });
    expect(useWorkspaceStore.getState().gitPanel.activeSection).toBe('tests');
    expect(screen.getByRole('tab', { name: 'Tests' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Tests' }), { key: 'ArrowRight' });
    expect(useWorkspaceStore.getState().gitPanel.activeSection).toBe('sourceControl');
  });

  it('puts a busy tab on its own toolbar row, outside the strip that holds the tabs', () => {
    useWorkspaceStore.getState().setGitPanel({ activeSection: 'tests' });
    renderTabs();
    const strip = screen.getByRole('tablist', { name: 'Panel sections' }).parentElement;
    expect(strip).not.toBeNull();
    expect(
      within(strip as HTMLElement).queryByRole('button', { name: 'Run all tests' }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Run all tests' })).toBeInTheDocument();
  });

  it('shows a quieter tab its buttons in the strip itself', () => {
    useWorkspaceStore.getState().setGitPanel({ activeSection: 'explorer' });
    renderTabs();
    expect(screen.getByRole('button', { name: 'Refresh files' })).toBeInTheDocument();
  });
});
