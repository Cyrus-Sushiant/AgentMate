import { useEffect, useRef, useState } from 'react';
import { Compress, ImageIcon, ZoomIn, ZoomOut } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** The stops the zoom buttons walk through, the way an image editor does. */
const ZOOM_STEPS = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];
const MIN_ZOOM = ZOOM_STEPS[0] as number;
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1] as number;
/** Breathing room around an image that fits, so it never touches the edges of the pane. */
const FIT_PADDING = 24;

export interface ImageSize {
  width: number;
  height: number;
}

/** A light checkerboard, so a transparent PNG reads as transparent and not as white. */
const CHECKERBOARD: React.CSSProperties = {
  backgroundImage:
    'repeating-conic-gradient(hsl(var(--foreground) / 0.07) 0% 25%, transparent 0% 50%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0',
};

function stepZoom(current: number, direction: 1 | -1): number {
  if (direction === 1) return ZOOM_STEPS.find((step) => step > current + 0.001) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((step) => step < current - 0.001) ?? MIN_ZOOM;
}

function clamp(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value));
}

/**
 * An image on a checkerboard, with zoom and drag to pan. It starts fitted to the pane and stays
 * that way while the pane is resized, until the zoom buttons or Ctrl+wheel pin a scale.
 */
export function ImageView({
  src,
  alt,
  onSize,
  className,
}: {
  src: string;
  alt: string;
  /** Called once the picture is decoded, so a header can show its dimensions. */
  onSize?: (size: ImageSize) => void;
  className?: string;
}): React.JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<ImageSize | null>(null);
  const [natural, setNatural] = useState<ImageSize | null>(null);
  /** null means "fit the pane", which is where every image starts. */
  const [zoom, setZoom] = useState<number | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [broken, setBroken] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  // A new picture starts over: fitted, centered, and hopefully not broken.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the source is the trigger, not a read
  useEffect(() => {
    setNatural(null);
    setZoom(null);
    setPan({ x: 0, y: 0 });
    setBroken(false);
  }, [src]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry?.contentRect;
      if (rect) setBox({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitScale =
    natural && box && natural.width > 0 && natural.height > 0
      ? Math.min(
          1,
          Math.max(box.width - FIT_PADDING, 1) / natural.width,
          Math.max(box.height - FIT_PADDING, 1) / natural.height,
        )
      : 1;
  const scale = zoom ?? fitScale;
  const width = natural ? natural.width * scale : 0;
  const height = natural ? natural.height * scale : 0;
  // Panning only makes sense while the picture is bigger than the pane it sits in.
  const slack = box
    ? { x: Math.max(0, (width - box.width) / 2), y: Math.max(0, (height - box.height) / 2) }
    : { x: 0, y: 0 };
  const offset = { x: clamp(pan.x, slack.x), y: clamp(pan.y, slack.y) };
  const pannable = slack.x > 0 || slack.y > 0;

  function zoomBy(direction: 1 | -1): void {
    setZoom((current) => stepZoom(current ?? fitScale, direction));
  }

  function toggleActualSize(): void {
    setPan({ x: 0, y: 0 });
    setZoom((current) => (current === null ? 1 : null));
  }

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      <div
        ref={boxRef}
        style={CHECKERBOARD}
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden',
          pannable ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default',
        )}
        onWheel={(event) => {
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            zoomBy(event.deltaY < 0 ? 1 : -1);
            return;
          }
          if (!pannable) return;
          event.preventDefault();
          setPan((current) => ({ x: current.x - event.deltaX, y: current.y - event.deltaY }));
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !pannable) return;
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const from = drag.current;
          if (!from || from.pointerId !== event.pointerId) return;
          const dx = event.clientX - from.x;
          const dy = event.clientY - from.y;
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
          setPan((current) => ({ x: current.x + dx, y: current.y + dy }));
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        onDoubleClick={toggleActualSize}
      >
        {broken ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">This image could not be shown</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              The file may be damaged, or saved in a format the viewer does not read.
            </p>
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            draggable={false}
            onLoad={(event) => {
              const size = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              };
              setNatural(size);
              onSize?.(size);
            }}
            onError={() => setBroken(true)}
            style={{
              width: natural ? `${width}px` : undefined,
              height: natural ? `${height}px` : undefined,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              // Zoomed well past 1:1 the picture is being inspected, so keep the pixels crisp.
              imageRendering: scale >= 3 ? 'pixelated' : 'auto',
            }}
            className="absolute left-1/2 top-1/2 max-w-none select-none"
          />
        )}
      </div>
      {natural && !broken ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border/60 bg-background/90 p-0.5 shadow-sm backdrop-blur">
            <SimpleTooltip label="Zoom out">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => zoomBy(-1)}
                disabled={scale <= MIN_ZOOM}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ZoomOut className="h-2.5 w-2.5" />
              </button>
            </SimpleTooltip>
            <SimpleTooltip label={zoom === null ? 'Show at actual size' : 'Fit to the pane'}>
              <button
                type="button"
                onClick={toggleActualSize}
                className="min-w-[3.25rem] rounded-full px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                {Math.round(scale * 100)}%
              </button>
            </SimpleTooltip>
            <SimpleTooltip label="Zoom in">
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => zoomBy(1)}
                disabled={scale >= MAX_ZOOM}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ZoomIn className="h-2.5 w-2.5" />
              </button>
            </SimpleTooltip>
            <SimpleTooltip label="Fit to the pane">
              <button
                type="button"
                aria-label="Fit to the pane"
                onClick={() => {
                  setZoom(null);
                  setPan({ x: 0, y: 0 });
                }}
                disabled={zoom === null}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Compress className="h-2.5 w-2.5" />
              </button>
            </SimpleTooltip>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** "1920 × 1080", for a header or a caption next to the file size. */
export function formatImageSize(size: ImageSize | null): string | null {
  return size ? `${size.width} × ${size.height}` : null;
}
