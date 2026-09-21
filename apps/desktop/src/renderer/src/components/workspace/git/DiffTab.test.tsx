// @vitest-environment jsdom
import type { Project } from '@agentmat/core';
import type { GitFileDiff, WorkspaceGitState } from '@shared/apiTypes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { WorkspaceDiffTab } from '@/stores/workspaceStore';
import { installAgentmatBridge } from '../../../../../test/renderer/agentmatBridge';

/**
 * Which viewer a changed file lands in. Git calls a picture "binary" and hands over no text, so
 * the one thing worth pinning down here is that an image goes to the image viewer and every
 * other binary keeps the notice it has always had.
 */

vi.mock('@/components/editor/MonacoDiffEditor', () => ({
  MonacoDiffEditor: ({ modified }: { modified: string }) => (
    <div data-testid="monaco-diff">{modified}</div>
  ),
  languageFor: () => 'plaintext',
}));
vi.mock('./ImageDiffView', () => ({
  ImageDiffView: ({ tab }: { tab: WorkspaceDiffTab }) => (
    <div data-testid="image-diff">{tab.path}</div>
  ),
}));

const DiffTab = (await import('./DiffTab')).default;

const project = { id: 'p1', name: 'App', folderPath: 'E:\\work\\app' } as Project;

function tab(path: string): WorkspaceDiffTab {
  return { kind: 'diff', id: 'd1', path, side: 'unstaged', preview: false };
}

function diff(path: string, patch: Partial<GitFileDiff> = {}): GitFileDiff {
  return { path, original: '', modified: '', binary: false, tooLarge: false, ...patch };
}

const state: Partial<WorkspaceGitState> = {
  isRepo: true,
  staged: [],
  unstaged: [],
  untracked: [],
  conflicts: [],
  projectPrefix: '',
};

function renderDiff(fileTab: WorkspaceDiffTab, answer: GitFileDiff) {
  installAgentmatBridge({ 'git.fileDiff': answer, 'git.workspaceState': state });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <DiffTab project={project} tab={fileTab} focused />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('DiffTab', () => {
  it('sends a changed image to the image viewer', async () => {
    renderDiff(tab('assets/logo.png'), diff('assets/logo.png', { binary: true }));

    expect(await screen.findByTestId('image-diff')).toHaveTextContent('assets/logo.png');
    expect(screen.queryByText('Binary file')).not.toBeInTheDocument();
  });

  it('still shows a picture that is too large for a text diff', async () => {
    renderDiff(tab('assets/logo.png'), diff('assets/logo.png', { binary: true, tooLarge: true }));

    expect(await screen.findByTestId('image-diff')).toBeInTheDocument();
    expect(screen.queryByText('This file is too large to diff here')).not.toBeInTheDocument();
  });

  it('keeps the notice for any other binary file', async () => {
    renderDiff(tab('dist/bundle.zip'), diff('dist/bundle.zip', { binary: true }));

    expect(await screen.findByText('Binary file')).toBeInTheDocument();
    expect(screen.queryByTestId('image-diff')).not.toBeInTheDocument();
  });

  it('leaves an SVG in the text diff, where its source can be read', async () => {
    renderDiff(
      tab('assets/icon.svg'),
      diff('assets/icon.svg', { original: '<svg />', modified: '<svg id="a" />' }),
    );

    expect(await screen.findByTestId('monaco-diff')).toHaveTextContent('<svg id="a" />');
    expect(screen.queryByTestId('image-diff')).not.toBeInTheDocument();
  });
});
