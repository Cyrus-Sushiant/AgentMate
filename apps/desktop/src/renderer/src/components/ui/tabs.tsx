import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight } from '@/components/icons';

const Tabs = TabsPrimitive.Root;

/** Width of the fade drawn over an end of the strip that has more tabs past it. */
const EDGE_FADE = '20px';
/** How far a click on an edge arrow scrolls the strip. */
const EDGE_SCROLL = 120;

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  /** Classes for the wrapper that draws the underline behind the strip. */
  containerClassName?: string;
};

/**
 * The trigger strip scrolls sideways rather than squeezing or clipping its tabs
 * when the window is too narrow to fit them all (Project details has ten). The
 * overflowing end fades out so it reads as "there is more this way", and the
 * underline lives on the wrapper so the scroll container never clips the active
 * tab's indicator.
 */
const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, containerClassName, onScroll, ...props }, ref) => {
    const listRef = React.useRef<HTMLDivElement | null>(null);
    const [overflow, setOverflow] = React.useState({ start: false, end: false });

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        listRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const syncOverflow = React.useCallback(() => {
      const el = listRef.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      setOverflow((prev) => {
        const next = { start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 };
        return prev.start === next.start && prev.end === next.end ? prev : next;
      });
    }, []);

    React.useLayoutEffect(() => {
      const el = listRef.current;
      if (!el) return;
      // A tab selected while off-screen (or restored on mount) must be visible.
      el.querySelector('[data-state="active"]')?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
      syncOverflow();
      const observer = new ResizeObserver(syncOverflow);
      observer.observe(el);
      for (const child of Array.from(el.children)) observer.observe(child);
      return () => observer.disconnect();
    }, [syncOverflow]);

    React.useEffect(() => {
      const el = listRef.current;
      if (!el) return;
      // A plain mouse wheel only sends vertical delta, and the strip's own
      // scrollbar is hidden, so without this a mouse-only user has no way to
      // reach tabs past the fade. Trackpad horizontal scroll (deltaX) already
      // works natively and is left alone.
      const onWheel = (event: WheelEvent) => {
        if (el.scrollWidth <= el.clientWidth) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        el.scrollLeft += event.deltaY;
        event.preventDefault();
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, []);

    const scrollBy = React.useCallback((delta: number) => {
      listRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
    }, []);

    const mask =
      overflow.start || overflow.end
        ? `linear-gradient(to right, ${[
            overflow.start ? `transparent 0px, black ${EDGE_FADE}` : 'black 0px',
            overflow.end ? `black calc(100% - ${EDGE_FADE}), transparent 100%` : 'black 100%',
          ].join(', ')})`
        : undefined;

    return (
      <div className={cn('relative border-b border-border', containerClassName)}>
        <TabsPrimitive.List
          ref={setRefs}
          onScroll={(event) => {
            syncOverflow();
            onScroll?.(event);
          }}
          style={{ maskImage: mask, WebkitMaskImage: mask }}
          className={cn(
            '-mb-px inline-flex h-9 w-full items-center justify-start gap-1 overflow-x-auto overflow-y-hidden text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            className,
          )}
          {...props}
        />
        {overflow.start && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Scroll tabs left"
            onClick={() => scrollBy(-EDGE_SCROLL)}
            className="absolute inset-y-0 left-0 flex w-5 items-center justify-start text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
          </button>
        )}
        {overflow.end && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Scroll tabs right"
            onClick={() => scrollBy(EDGE_SCROLL)}
            className="absolute inset-y-0 right-0 flex w-5 items-center justify-end text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="size-3" />
          </button>
        )}
      </div>
    );
  },
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, onClick, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    onClick={(event) => {
      // Clicking a half-visible tab pulls it fully into the strip.
      event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      onClick?.(event);
    }}
    className={cn(
      'inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-foreground hover:text-foreground',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-3 focus-visible:outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
