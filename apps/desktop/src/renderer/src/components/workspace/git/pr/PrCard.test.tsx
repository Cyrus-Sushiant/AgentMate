import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { PrSurfaceLeaveContext, useRevealInPanel } from './PrCard';

beforeEach(() => {
  useWorkspaceStore.getState().setSourceSectionOpen('changes', false);
});

describe('useRevealInPanel', () => {
  it('just opens the section when used in the panel', () => {
    const { result } = renderHook(() => useRevealInPanel());
    result.current('changes');
    expect(useWorkspaceStore.getState().gitPanel.openSourceSections.changes).toBe(true);
  });

  it('closes the large view first when it sits inside one', () => {
    const leave = vi.fn();
    const { result } = renderHook(() => useRevealInPanel(), {
      wrapper: ({ children }) => (
        <PrSurfaceLeaveContext.Provider value={leave}>{children}</PrSurfaceLeaveContext.Provider>
      ),
    });
    result.current('changes');
    expect(leave).toHaveBeenCalledOnce();
    expect(useWorkspaceStore.getState().gitPanel.openSourceSections.changes).toBe(true);
  });
});
