import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVirtualRows, visibleWindow } from './useVirtualRows';

describe('visibleWindow', () => {
  it('draws only the rows in view, plus a few either side', () => {
    expect(
      visibleWindow({ count: 1000, rowHeight: 28, height: 280, scrollTop: 2800, overscan: 5 }),
    ).toEqual({ start: 95, end: 115 });
  });

  it('stays inside the list at both ends', () => {
    expect(
      visibleWindow({ count: 12, rowHeight: 28, height: 280, scrollTop: 0, overscan: 5 }),
    ).toEqual({ start: 0, end: 12 });
  });

  it('draws everything before the list has a size', () => {
    expect(
      visibleWindow({ count: 50, rowHeight: 28, height: 0, scrollTop: 0, overscan: 5 }),
    ).toEqual({ start: 0, end: 50 });
  });
});

describe('useVirtualRows', () => {
  it('pads the space of the rows it leaves out', () => {
    const { result } = renderHook(() => useVirtualRows(100, 28));
    expect(result.current.start).toBe(0);
    expect(result.current.end).toBe(100);
    expect(result.current.padTop).toBe(0);
    expect(result.current.padBottom).toBe(0);
  });

  it('scrolls a row into view from above or below', () => {
    const { result } = renderHook(() => useVirtualRows(100, 28));
    const box = { scrollTop: 0, clientHeight: 280 } as HTMLDivElement;
    act(() => result.current.containerRef(box));
    act(() => result.current.scrollToIndex(50));
    expect(box.scrollTop).toBe(50 * 28 + 28 - 280);
    act(() => result.current.scrollToIndex(2));
    expect(box.scrollTop).toBe(2 * 28);
  });
});
