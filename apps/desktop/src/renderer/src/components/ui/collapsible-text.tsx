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
    // A soft inset well, the same as the page kit's SECTION_WELL, so it sits inside a glass card
    // without an opaque box of its own.
    <div className="overflow-hidden rounded-xl bg-foreground/[0.03] ring-1 ring-inset ring-foreground/[0.07]">
      <p
        ref={ref}
        dir={persian.dir}
        // A mask fades the clamped text over any backdrop, where a gradient would need the
        // well's colour, which is translucent.
        style={
          collapsed
            ? {
                maxHeight: collapsedHeight,
                maskImage: 'linear-gradient(to bottom, black calc(100% - 2.5rem), transparent)',
              }
            : undefined
        }
        className={cn(
          'overflow-hidden whitespace-pre-wrap p-3 text-sm leading-relaxed',
          persian.className,
          className,
        )}
      >
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full cursor-pointer items-center justify-center gap-1 px-3 py-1.5 text-xs text-muted-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
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
