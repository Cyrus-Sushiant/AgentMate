// @vitest-environment jsdom
import type { Project } from '@agentmat/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';

/**
 * A pipelines refresh that fails while the Fix with AI dialog is open used to swap the run rows for
 * the error notice. That unmounted the dialog and the user lost the prompt they were reading.
 */

const mounts = vi.fn();
const unmounts = vi.fn();

vi.mock('./FixRunDialog', async () => {
  const React = await import('react');
  return {
    FixRunDialog: () => {
      React.useEffect(() => {
        mounts();
        return () => unmounts();
      }, []);
      return <div>fix dialog</div>;
    },
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { PipelinesSection } = await import('./PipelinesSection');

const project = { id: 'p1', name: 'App', folderPath: 'C:\\work\\app' } as Project;

const healthy = {
  projectId: 'p1',
  cliAvailable: true,
  authenticated: true,
  github: { owner: 'acme', repo: 'app' },
  workflows: [{ id: 1, name: 'CI', htmlUrl: 'https://github.com/acme/app/actions/workflows/ci' }],
  runsByWorkflowId: {
    1: {
      id: 42,
      workflowId: 1,
      name: 'CI',
      displayTitle: 'Add login',
      runNumber: 7,
      headBranch: 'main',
      status: 'completed',
      conclusion: 'failure',
      htmlUrl: 'https://github.com/acme/app/actions/runs/42',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  },
};

const status = vi.fn();

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TooltipProvider>
          <PipelinesSection project={project} />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

async function refresh(client: QueryClient) {
  await act(async () => {
    await client.invalidateQueries({ queryKey: queryKeys.pipelineStatus(project.id) });
    // let React Query notify observers and React commit the result
    await new Promise((done) => setTimeout(done, 20));
  });
}

beforeEach(() => {
  mounts.mockClear();
  unmounts.mockClear();
  status.mockReset();
  Object.assign(window, { agentmat: { pipelines: { status }, shell: { openExternal: vi.fn() } } });
});

afterEach(() => cleanup());

describe('PipelinesSection refresh errors', () => {
  it('keeps an open Fix with AI dialog when a refresh reports an error', async () => {
    status.mockResolvedValueOnce(healthy);
    const client = renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /Fix with AI/ }));
    expect(await screen.findByText('fix dialog')).toBeTruthy();

    status.mockResolvedValueOnce({ ...healthy, error: 'rate limited' });
    await refresh(client);

    expect(status).toHaveBeenCalledTimes(2);
    expect(screen.getByText('fix dialog')).toBeTruthy();
    expect(screen.queryByText('Could not load pipelines')).toBeNull();
    expect(unmounts).not.toHaveBeenCalled();
    expect(mounts).toHaveBeenCalledTimes(1);
  });

  it('keeps an open Fix with AI dialog when a refresh throws', async () => {
    status.mockResolvedValueOnce(healthy);
    const client = renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /Fix with AI/ }));
    await screen.findByText('fix dialog');

    status.mockRejectedValueOnce(new Error('network down'));
    await refresh(client);

    expect(screen.getByText('fix dialog')).toBeTruthy();
    expect(unmounts).not.toHaveBeenCalled();
  });

  it('still shows the error notice when the very first load fails', async () => {
    status.mockResolvedValueOnce({ ...healthy, error: 'rate limited', workflows: [] });
    renderSection();
    expect(await screen.findByText('Could not load pipelines')).toBeTruthy();
  });

  it('recovers to fresh data after a failed refresh', async () => {
    status.mockResolvedValueOnce(healthy);
    const client = renderSection();
    await screen.findByText('CI');

    status.mockResolvedValueOnce({ ...healthy, error: 'rate limited' });
    await refresh(client);
    status.mockResolvedValueOnce({
      ...healthy,
      workflows: [{ id: 1, name: 'Release', htmlUrl: 'https://github.com/acme/app' }],
    });
    await refresh(client);

    await waitFor(() => expect(screen.getByText('Release')).toBeTruthy());
  });
});
