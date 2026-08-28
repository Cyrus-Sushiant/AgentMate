import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from '@/components/icons';
import { persianTextProps } from '@/lib/rtl';
import { cn } from '@/lib/utils';

/**
 * A card of free text that clamps itself once it gets tall, with a Show
 * more/Show less toggle. Short text renders exactly as it did before: the
 * toggle only appears when the content actually overflows the collapsed
 * height, so a two-line prompt never grows a pointless button.
 */
export function CollapsibleText({
  text,
  collapsedHeight = 168,
  className,
}: {
  text: string;
  /** Height in px the text is clamped to while collapsed. */
  collapsedHeight?: number;
  className?: string;
}): React.JSX.Element {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight is the full content height even while max-height clamps it.
    setOverflowing(el.scrollHeight > collapsedHeight + 8);
  }, [collapsedHeight]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: new text has to be re-measured, and while collapsed its height never changes, so the observer alone would not notice
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    // Re-measure on width changes, since rewrapping changes how tall it is.
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    return () => resize.disconnect();
  }, [measure, text]);

  const persian = persianTextProps(text);
  const collapsed = overflowing && !expanded;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative">
        <p
          ref={ref}
          dir={persian.dir}
          style={collapsed ? { maxHeight: collapsedHeight } : undefined}
          className={cn(
            'overflow-hidden whitespace-pre-wrap p-3 text-sm leading-relaxed',
            persian.className,
            className,
          )}
        >
          {text}
        </p>
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-center gap-1 border-t border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
          />
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
