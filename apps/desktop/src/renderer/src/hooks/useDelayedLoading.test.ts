import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDelayedLoading } from './useDelayedLoading';

/**
 * The whole point of this hook is that a fast fetch never flashes a spinner and a slow one
 * never blinks it away again, so every test here is about timing rather than rendering.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe('useDelayedLoading', () => {
  it('stays hidden while nothing is loading', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDelayedLoading(false));
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(false);
  });

  it('waits out the show delay before it admits to loading', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDelayedLoading(true, 400, 400));

    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  // A request that comes back in 100ms should leave the screen alone entirely.
  it('never shows anything for a fetch that finishes inside the delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading, 400, 400), {
      initialProps: { loading: true },
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(false);
  });

  // Once the spinner is up it has to stay up, otherwise it reads as a glitch.
  it('holds the spinner for the minimum visible time after loading ends', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading, 400, 400), {
      initialProps: { loading: true },
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe(true);

    // Loading stops the instant it became visible, so the full minimum is still owed.
    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('hides right away when the spinner has already been up longer than the minimum', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading, 100, 200), {
      initialProps: { loading: true },
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe(false);
  });
});
