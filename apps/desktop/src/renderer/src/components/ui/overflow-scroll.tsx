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
  fill = false,
  surface = 'popover',
}: {
  children: ReactNode;
  className?: string;
  /** Stretch to the parent (dialog body). Leave off for a max-height list. */
  fill?: boolean;
  surface?: 'popover' | 'card';
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

  const fadeFrom = surface === 'card' ? 'from-card' : 'from-popover';

  return (
    <div className={cn('relative min-h-0', fill && 'h-full')}>
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
