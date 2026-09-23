import { QueryClient, useMutation } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderHookWithProviders } from '../../../test/renderer/renderWithProviders';
import { useAppLoadingOverlay, useStartupLoading } from './useAppLoadingOverlay';

/**
 * The full page overlay belongs to the cold start and to writes the user is waiting on. Anything
 * else (a second page, a poll, a refetch) is meant to shimmer in place instead, so the tests below
 * are mostly about the overlay staying down.
 */

function client(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/** A promise the test decides when to settle, standing in for a slow IPC call. */
function gate(): { promise: Promise<string>; settle: () => void } {
  let settle = (): void => undefined;
  const promise = new Promise<string>((resolve) => {
    settle = () => resolve('done');
  });
  return { promise, settle };
}

describe('useAppLoadingOverlay', () => {
  it('stays down when nothing is in flight', async () => {
    const { result } = renderHookWithProviders(() => useAppLoadingOverlay(), {
      queryClient: client(),
    });
    expect(result.current).toBe(false);
    // Well past the show delay, with no query ever started.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(result.current).toBe(false);
  });

  it('covers the first batch of queries and retires once they settle', async () => {
    const queryClient = client();
    const boot = gate();
    const { result } = renderHookWithProviders(() => useAppLoadingOverlay(), { queryClient });

    act(() => {
      void queryClient.prefetchQuery({ queryKey: ['boot'], queryFn: () => boot.promise });
    });
    await waitFor(() => expect(result.current).toBe(true));

    act(() => boot.settle());
    await waitFor(() => expect(result.current).toBe(false));
  });

  // The whole point of retiring the overlay: opening another page must not blank the app.
  it('does not come back for a query started after the boot', async () => {
    const queryClient = client();
    const boot = gate();
    const { result } = renderHookWithProviders(() => useAppLoadingOverlay(), { queryClient });

    act(() => {
      void queryClient.prefetchQuery({ queryKey: ['boot'], queryFn: () => boot.promise });
    });
    await waitFor(() => expect(result.current).toBe(true));
    act(() => boot.settle());
    await waitFor(() => expect(result.current).toBe(false));

    const later = gate();
    act(() => {
      void queryClient.prefetchQuery({ queryKey: ['later'], queryFn: () => later.promise });
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(result.current).toBe(false);
    act(() => later.settle());
  });

  it('ignores a query that opted out with silentLoading', async () => {
    const queryClient = client();
    const quiet = gate();
    const { result } = renderHookWithProviders(() => useAppLoadingOverlay(), { queryClient });

    act(() => {
      void queryClient.prefetchQuery({
        queryKey: ['ip-lookup'],
        queryFn: () => quiet.promise,
        meta: { silentLoading: true },
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(result.current).toBe(false);
    act(() => quiet.settle());
  });

  it('covers a write the user is waiting on', async () => {
    const queryClient = client();
    const write = gate();
    const { result } = renderHookWithProviders(
      () => ({
        overlay: useAppLoadingOverlay(),
        save: useMutation({ mutationFn: () => write.promise }),
      }),
      { queryClient },
    );

    act(() => {
      result.current.save.mutate();
    });
    await waitFor(() => expect(result.current.overlay).toBe(true));

    act(() => write.settle());
    await waitFor(() => expect(result.current.overlay).toBe(false));
  });

  it('leaves a mutation alone when its own button already shows progress', async () => {
    const queryClient = client();
    const write = gate();
    const { result } = renderHookWithProviders(
      () => ({
        overlay: useAppLoadingOverlay(),
        save: useMutation({ mutationFn: () => write.promise, meta: { silentLoading: true } }),
      }),
      { queryClient },
    );

    act(() => {
      result.current.save.mutate();
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(result.current.overlay).toBe(false);
    act(() => write.settle());
  });
});

// The main window waits behind the startup splash until `booted`, so these decide when it opens.
describe('useStartupLoading', () => {
  it('stays not booted while the first page is still fetching, then boots', async () => {
    const queryClient = client();
    const boot = gate();
    const { result } = renderHookWithProviders(() => useStartupLoading(), { queryClient });

    act(() => {
      void queryClient.prefetchQuery({ queryKey: ['boot'], queryFn: () => boot.promise });
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(result.current.booted).toBe(false);

    act(() => boot.settle());
    await waitFor(() => expect(result.current.booted).toBe(true));
    expect(result.current.showOverlay).toBe(false);
  });

  it('does not wait on a slow query that opted out with silentLoading', async () => {
    const queryClient = client();
    const quick = gate();
    const slow = gate();
    const { result } = renderHookWithProviders(() => useStartupLoading(), { queryClient });

    act(() => {
      void queryClient.prefetchQuery({ queryKey: ['projects'], queryFn: () => quick.promise });
      void queryClient.prefetchQuery({
        queryKey: ['cli-status'],
        queryFn: () => slow.promise,
        meta: { silentLoading: true },
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.booted).toBe(false);
    act(() => quick.settle());
    // Well inside the 1.5s no-query grace, so this is the settle booting it, not the timer.
    await waitFor(() => expect(result.current.booted).toBe(true), { timeout: 800 });
    act(() => slow.settle());
  });

  it('boots after the grace period when the page has no queries at all', async () => {
    const { result } = renderHookWithProviders(() => useStartupLoading(), {
      queryClient: client(),
    });
    expect(result.current.booted).toBe(false);
    await waitFor(() => expect(result.current.booted).toBe(true), { timeout: 2500 });
  });
});
