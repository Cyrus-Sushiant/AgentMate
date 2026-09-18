import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from './projectStore';

/**
 * This store only remembers which project the app is pointed at. Everything a project page
 * shows is a React Query cache entry, so there is no optimistic update or rollback here.
 */
beforeEach(() => {
  useProjectStore.setState({ activeProjectId: null });
});

describe('useProjectStore', () => {
  it('starts with no project selected', () => {
    expect(useProjectStore.getState().activeProjectId).toBeNull();
  });

  it('remembers the project that was picked', () => {
    useProjectStore.getState().setActiveProjectId('p1');
    expect(useProjectStore.getState().activeProjectId).toBe('p1');
  });

  it('replaces one project with the next', () => {
    useProjectStore.getState().setActiveProjectId('p1');
    useProjectStore.getState().setActiveProjectId('p2');
    expect(useProjectStore.getState().activeProjectId).toBe('p2');
  });

  it('clears the selection', () => {
    useProjectStore.getState().setActiveProjectId('p1');
    useProjectStore.getState().setActiveProjectId(null);
    expect(useProjectStore.getState().activeProjectId).toBeNull();
  });
});
