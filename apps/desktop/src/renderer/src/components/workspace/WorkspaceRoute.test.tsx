// @vitest-environment jsdom

import { screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import WorkspaceRoute from './WorkspaceRoute';

/**
 * A pipeline failure alert can send you to a project's Workspace with `?panel=pipelines`. The
 * route has to unfold that section of the Git panel and then drop the param, so a reload or the
 * back button does not unfold it again after the user folded it away.
 */

function Probe(): React.JSX.Element {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
}

function renderRoute(route: string) {
  return renderWithProviders(
    <>
      <WorkspaceRoute />
      <Probe />
    </>,
    { route, path: '/workspace/:projectId', bridge: { 'projects.list': [] } },
  );
}

const location = (): string | null | undefined => screen.getByTestId('location').textContent;

beforeEach(() => {
  useWorkspaceStore.setState({
    workspaces: {},
    railProjectIds: [],
    activeProjectId: null,
  });
  // Start with the panel folded away and on another tab, the way it is when nobody opened it.
  useWorkspaceStore.getState().setGitPanel({ collapsed: true, activeSection: 'explorer' });
  useWorkspaceStore.getState().setSourceSectionOpen('pipelines', false);
});

describe('WorkspaceRoute ?panel=', () => {
  it('opens the Pipelines section of the Git panel and drops the param', async () => {
    renderRoute('/workspace/p1?panel=pipelines');

    await waitFor(() => expect(location()).toBe('/workspace/p1'));
    const { gitPanel, activeProjectId } = useWorkspaceStore.getState();
    expect(activeProjectId).toBe('p1');
    expect(gitPanel.collapsed).toBe(false);
    expect(gitPanel.activeSection).toBe('sourceControl');
    expect(gitPanel.openSourceSections.pipelines).toBe(true);
  });

  it('leaves the panel alone for a section that does not exist', async () => {
    renderRoute('/workspace/p1?panel=nonsense');

    // The param is still consumed, so a hand-edited link cannot linger in the address.
    await waitFor(() => expect(location()).toBe('/workspace/p1'));
    const { gitPanel } = useWorkspaceStore.getState();
    expect(gitPanel.collapsed).toBe(true);
    expect(gitPanel.activeSection).toBe('explorer');
    expect(gitPanel.openSourceSections.pipelines).toBe(false);
  });

  it('keeps the other params a link carries', async () => {
    renderRoute('/workspace/p1?panel=pipelines&session=s9');

    await waitFor(() => expect(location()).not.toContain('panel='));
    expect(useWorkspaceStore.getState().gitPanel.openSourceSections.pipelines).toBe(true);
  });

  it('does nothing without the param', async () => {
    renderRoute('/workspace/p1');

    await waitFor(() => expect(useWorkspaceStore.getState().activeProjectId).toBe('p1'));
    expect(useWorkspaceStore.getState().gitPanel.collapsed).toBe(true);
    expect(location()).toBe('/workspace/p1');
  });
});
