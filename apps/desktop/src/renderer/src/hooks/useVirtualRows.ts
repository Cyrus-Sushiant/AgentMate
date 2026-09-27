import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

/**
 * Draws a long list of equal-height rows a screenful at a time. A text search can bring back
 * thousands of lines, and keeping them all in the DOM makes every keystroke and scroll pay
 * for rows nobody can see.
 */

export interface WindowInput {
  count: number;
  rowHeight: number;
  /** The visible height of the list. 0 before it has been laid out. */
  height: number;
  scrollTop: number;
  overscan: number;
}

export function visibleWindow({ count, rowHeight, height, scrollTop, overscan }: WindowInput): {
  start: number;
  end: number;
} {
  // Before layout (and in tests) there is no height to go by, so everything is drawn.
  if (height <= 0) return { start: 0, end: count };
  const first = Math.floor(scrollTop / rowHeight);
  const last = Math.ceil((scrollTop + height) / rowHeight);
  return { start: Math.max(0, first - overscan), end: Math.min(count, last + overscan) };
}

export function useVirtualRows(count: number, rowHeight: number, overscan = 8) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ height: 0, scrollTop: 0 });

  const measure = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    setViewport((current) =>
      current.height === box.clientHeight && current.scrollTop === box.scrollTop
        ? current
        : { height: box.clientHeight, scrollTop: box.scrollTop },
    );
  }, []);

  const observerRef = useRef<ResizeObserver | null>(null);
  const containerRef = useCallback(
    (box: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      boxRef.current = box;
      if (!box) return;
      if (typeof ResizeObserver !== 'undefined') {
        observerRef.current = new ResizeObserver(measure);
        observerRef.current.observe(box);
      }
      measure();
    },
    [measure],
  );

  // A shorter list can leave the box scrolled past its end, so the count is a trigger too.
  useLayoutEffect(measure, [count, measure]);

  const { start, end } = useMemo(
    () => visibleWindow({ count, rowHeight, overscan, ...viewport }),
    [count, rowHeight, overscan, viewport],
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      const box = boxRef.current;
      if (!box || index < 0) return;
      const top = index * rowHeight;
      const bottom = top + rowHeight;
      if (top < box.scrollTop) box.scrollTop = top;
      else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
      measure();
    },
    [rowHeight, measure],
  );

  return {
    containerRef,
    onScroll: measure,
    start,
    end,
    padTop: start * rowHeight,
    padBottom: Math.max(0, (count - end) * rowHeight),
    scrollToIndex,
  };
}
