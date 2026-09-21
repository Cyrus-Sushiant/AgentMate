// @vitest-environment jsdom
import type { Project } from '@agentmat/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { WorkspaceFileTab } from '@/stores/workspaceStore';
import { installAgentmatBridge } from '../../../../test/renderer/agentmatBridge';

// Monaco needs a real layout engine, and neither test below is about the editor itself.
vi.mock('@/components/editor/MonacoEditor', () => ({
  MonacoEditor: ({ value }: { value: string }) => <div data-testid="monaco">{value}</div>,
}));
vi.mock('@/components/editor/MonacoDiffEditor', () => ({ languageFor: () => 'plaintext' }));

const FileTab = (await import('./FileTab')).default;

const project = { id: 'p1', name: 'App', folderPath: 'E:\\work\\app' } as Project;

function tab(path: string): WorkspaceFileTab {
  return { kind: 'file', id: 't1', path, preview: false };
}

/** A fresh cache per test, so one test's picture is never the next one's cached answer. */
let client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

function wrap(fileTab: WorkspaceFileTab): React.JSX.Element {
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <FileTab project={project} tab={fileTab} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function renderTab(fileTab: WorkspaceFileTab) {
  return render(wrap(fileTab));
}

afterEach(cleanup);

describe('FileTab', () => {
  it('shows a picture in the viewer instead of its bytes', async () => {
    installAgentmatBridge({
      'fs.readImage': { dataUrl: 'data:image/png;base64,AAA', bytes: 2048 },
    });
    renderTab(tab('E:\\work\\app\\assets\\logo.png'));

    const image = await screen.findByAltText('logo.png');
    expect(image).toHaveAttribute('src', 'data:image/png;base64,AAA');
    expect(screen.queryByTestId('monaco')).not.toBeInTheDocument();
    expect(await screen.findByText('2.00 KB')).toBeInTheDocument();
  });

  it('says why an image could not be opened', async () => {
    installAgentmatBridge({
      'fs.readImage': () => Promise.reject(new Error('This image is too large to show here.')),
    });
    renderTab(tab('E:\\work\\app\\assets\\huge.png'));

    expect(await screen.findByText('This image could not be opened')).toBeInTheDocument();
    expect(screen.getByText('This image is too large to show here.')).toBeInTheDocument();
  });

  it('lets an SVG switch between the picture and its source', async () => {
    installAgentmatBridge({
      'fs.readImage': { dataUrl: 'data:image/svg+xml;base64,BBB', bytes: 300 },
      'fs.readFile': () => '<svg />',
    });
    renderTab(tab('E:\\work\\app\\assets\\icon.svg'));

    expect(await screen.findByAltText('icon.svg')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Edit the source'));
    expect(await screen.findByTestId('monaco')).toHaveTextContent('<svg />');

    fireEvent.click(screen.getByLabelText('Show the picture'));
    await waitFor(() => expect(screen.getByAltText('icon.svg')).toBeInTheDocument());
  });

  it('re-reads the file from disk on demand', async () => {
    const bridge = installAgentmatBridge({
      'fs.readImage': { dataUrl: 'data:image/png;base64,AAA', bytes: 2048 },
    });
    renderTab(tab('E:\\work\\app\\assets\\logo.png'));
    await screen.findByAltText('logo.png');
    expect(bridge.$fn('fs.readImage')).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Reload from disk'));
    await waitFor(() => expect(bridge.$fn('fs.readImage')).toHaveBeenCalledTimes(2));
  });

  it('hands the picture to its default app when asked', async () => {
    const bridge = installAgentmatBridge({
      'fs.readImage': { dataUrl: 'data:image/png;base64,AAA', bytes: 2048 },
    });
    renderTab(tab('E:\\work\\app\\assets\\logo.png'));
    await screen.findByAltText('logo.png');

    fireEvent.click(screen.getByLabelText('Open in its default app'));
    expect(bridge.$fn('shell.openPath')).toHaveBeenCalledWith('E:\\work\\app\\assets\\logo.png');
  });

  it('does not offer the source of a picture that has none', async () => {
    installAgentmatBridge({
      'fs.readImage': { dataUrl: 'data:image/png;base64,AAA', bytes: 2048 },
    });
    renderTab(tab('E:\\work\\app\\assets\\logo.png'));
    await screen.findByAltText('logo.png');
    expect(screen.queryByLabelText('Edit the source')).not.toBeInTheDocument();
  });

  it('goes back to the viewer when the tab is reused for another file', async () => {
    installAgentmatBridge({
      'fs.readImage': { dataUrl: 'data:image/svg+xml;base64,BBB', bytes: 300 },
      'fs.readFile': () => '<svg />',
    });
    const view = renderTab(tab('E:\\work\\app\\assets\\icon.svg'));
    await screen.findByAltText('icon.svg');
    fireEvent.click(screen.getByLabelText('Edit the source'));
    expect(await screen.findByTestId('monaco')).toBeInTheDocument();

    // A preview tab is reused for the next file clicked, which is a new picture, not source.
    view.rerender(wrap(tab('E:\\work\\app\\assets\\other.svg')));
    expect(await screen.findByAltText('other.svg')).toBeInTheDocument();
  });

  it('keeps a plain file in the editor', async () => {
    installAgentmatBridge({ 'fs.readFile': () => 'const a = 1;\n' });
    renderTab(tab('E:\\work\\app\\src\\index.ts'));

    expect(await screen.findByTestId('monaco')).toHaveTextContent('const a = 1;');
    expect(screen.queryByLabelText('Show the picture')).not.toBeInTheDocument();
  });
});
