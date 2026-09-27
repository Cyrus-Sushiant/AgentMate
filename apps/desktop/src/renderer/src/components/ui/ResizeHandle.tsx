import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A splitter between two panes. The caller owns the size of one pane (in pixels) and this reports
 * the new size while dragging or on arrow keys, clamped to `min` and `max`. A double click goes
 * back to `defaultSize`.
 *
 * `orientation` is the line's direction: a vertical line resizes widths, a horizontal line
 * heights. `invert` is for a pane that sits after the handle (below or to the right), which grows
 * as the handle moves up or left.
 */

interface ResizeHandleProps {
  orientation: 'vertical' | 'horizontal';
  label: string;
  size: number;
  min: number;
  max: number;
  defaultSize: number;
  invert?: boolean;
  onSizeChange: (size: number) => void;
  className?: string;
}

const KEY_STEP = 16;

export function ResizeHandle({
  orientation,
  label,
  size,
  min,
  max,
  defaultSize,
  invert = false,
  onSizeChange,
  className,
}: ResizeHandleProps): React.JSX.Element {
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ pointer: number; size: number } | null>(null);
  const vertical = orientation === 'vertical';

  const clamp = (value: number): number => Math.round(Math.min(max, Math.max(min, value)));
  const position = (event: React.PointerEvent): number =>
    vertical ? event.clientX : event.clientY;

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(size)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        start.current = { pointer: position(event), size };
        setDragging(true);
        document.body.style.cursor = vertical ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
      }}
      onPointerMove={(event) => {
        if (!start.current) return;
        const delta = position(event) - start.current.pointer;
        onSizeChange(clamp(start.current.size + (invert ? -delta : delta)));
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        start.current = null;
        setDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }}
      onPointerCancel={() => {
        start.current = null;
        setDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }}
      onDoubleClick={() => onSizeChange(clamp(defaultSize))}
      onKeyDown={(event) => {
        const grow = vertical ? 'ArrowRight' : 'ArrowDown';
        const shrink = vertical ? 'ArrowLeft' : 'ArrowUp';
        if (event.key !== grow && event.key !== shrink) return;
        event.preventDefault();
        const direction = (event.key === grow ? 1 : -1) * (invert ? -1 : 1);
        onSizeChange(clamp(size + direction * KEY_STEP));
      }}
      className={cn(
        'group/resize relative z-10 flex shrink-0 items-center justify-center focus-visible:outline-none',
        vertical ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none transition-colors',
          vertical ? 'h-full w-px' : 'h-px w-full',
          dragging
            ? 'bg-primary'
            : 'bg-border group-hover/resize:bg-primary/60 group-focus-visible/resize:bg-primary',
        )}
      />
      {/* A wider invisible hit area, so the line is easy to grab without looking thick. */}
      <span
        className={cn('absolute', vertical ? '-inset-x-1.5 inset-y-0' : '-inset-y-1.5 inset-x-0')}
      />
    </div>
  );
}
