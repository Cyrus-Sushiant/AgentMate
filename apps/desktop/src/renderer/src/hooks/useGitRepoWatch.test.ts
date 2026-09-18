import { QueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithProviders } from '../../../test/renderer/renderWithProviders';
import { useGitRepoWatch } from './useGitRepoWatch';

/**
 * This hook is what keeps the git panel honest when the repo moves under it: a commit made in
 * another app, or an edit made while the window was in the background. The tests check that it
 * asks main to watch, invalidates only on its own project, and cleans up after itself.
 */

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useGitRepoWatch', () => {
  it('asks main to watch the repo and stops watching on unmount', () => {
    const { bridge, unmount } = renderHookWithProviders(() => useGitRepoWatch('p1', true), {
      queryClient: client(),
    });

    expect(bridge.$fn('git.watchRepo')).toHaveBeenCalledWith('p1');
    expect(bridge.$listenerCount('git.onRepoChanged')).toBe(1);

    unmount();
    expect(bridge.$fn('git.unwatchRepo')).toHaveBeenCalledWith('p1');
    expect(bridge.$listenerCount('git.onRepoChanged')).toBe(0);
  });

  // A plain folder has no .git to watch, but it still listens so it can react once one appears.
  it('skips the watch for a folder that is not a repo yet', () => {
    const { bridge, unmount } = renderHookWithProviders(() => useGitRepoWatch('p1', false), {
      queryClient: client(),
    });

    expect(() => bridge.$fn('git.watchRepo')).toThrow();
    expect(bridge.$listenerCount('git.onRepoChanged')).toBe(1);

    unmount();
    expect(() => bridge.$fn('git.unwatchRepo')).toThrow();
  });

  it('refreshes the git queries when its own repo changes', async () => {
    const queryClient = client();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { bridge } = renderHookWithProviders(() => useGitRepoWatch('p1', true), { queryClient });

    act(() => {
      bridge.$emit('git.onRepoChanged', 'p1');
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    const keys = invalidate.mock.calls.map(([options]) => options?.queryKey);
    expect(keys).toContainEqual(queryKeys.gitStatus('p1'));
    expect(keys).toContainEqual(queryKeys.gitTags('p1'));
    expect(keys).toContainEqual(queryKeys.gitFiles('p1'));
    expect(keys).toContainEqual(queryKeys.gitBranchHistories('p1'));
  });

  it('ignores a change reported for a different project', () => {
    const queryClient = client();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { bridge } = renderHookWithProviders(() => useGitRepoWatch('p1', true), { queryClient });

    act(() => {
      bridge.$emit('git.onRepoChanged', 'p2');
    });

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('refreshes when the window regains focus, but throttles a burst of focus events', () => {
    vi.useFakeTimers();
    const queryClient = client();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderHookWithProviders(() => useGitRepoWatch('p1', true), { queryClient });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    const afterFirst = invalidate.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    // Raising the window then focusing a field fires twice in a row, which is one refresh.
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(invalidate.mock.calls.length).toBe(afterFirst);

    act(() => {
      vi.advanceTimersByTime(2001);
      window.dispatchEvent(new Event('focus'));
    });
    expect(invalidate.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('stops reacting to focus after unmount', () => {
    const queryClient = client();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { unmount } = renderHookWithProviders(() => useGitRepoWatch('p1', true), { queryClient });

    unmount();
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
