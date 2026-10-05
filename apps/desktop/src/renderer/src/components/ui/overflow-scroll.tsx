import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A region that only grows a scrollbar when its children don't fit. Edge fades
 * appear while there is more content above or below, so overflow is obvious
 * without a permanently visible bar.
 */
export function OverflowScroll({
  children,
  className,
  rootClassName,
  fill = false,
  surface = 'popover',
}: {
  children: ReactNode;
  className?: string;
  /** Classes for the outer wrapper that holds the scroller and its fades. */
  rootClassName?: string;
  /** Stretch to the parent (dialog body). Leave off for a max-height list. */
  fill?: boolean;
  /**
   * What the fades blend into. `chrome` is the window frame: the canvas colour normally, and
   * the see-through native material on a glass window, where an opaque fade would show as a
   * band, so the fades are left out there.
   */
  surface?: 'popover' | 'card' | 'background' | 'chrome';
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ up: false, down: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    setOverflow({
      up: scrollTop > 2,
      down: scrollTop + clientHeight < scrollHeight - 2,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const resize = new ResizeObserver(update);
    resize.observe(el);
    const mutate = new MutationObserver(update);
    mutate.observe(el, { childList: true, subtree: true, characterData: true });
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      resize.disconnect();
      mutate.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [update]);

  const fadeFrom =
    surface === 'card'
      ? 'from-card'
      : surface === 'background'
        ? 'from-background'
        : surface === 'chrome'
          ? 'from-background glass:hidden'
          : 'from-popover';

  return (
    <div className={cn('relative min-h-0', fill && 'h-full', rootClassName)}>
      <div
        ref={ref}
        className={cn('min-h-0 overflow-y-auto overscroll-contain', fill && 'h-full', className)}
      >
        {children}
      </div>
      {overflow.up && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 z-[1] h-7 bg-gradient-to-b to-transparent',
            fadeFrom,
          )}
        />
      )}
      {overflow.down && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-7 bg-gradient-to-t to-transparent',
            fadeFrom,
          )}
        />
      )}
    </div>
  );
}
