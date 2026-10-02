import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Robot, StopCircle } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { isRdpAgentActive, stopRdpAgentTask, useRdpAgentSession } from '@/stores/rdpAgentStore';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the remote screen sits inside the overlay, when it is letterboxed by "fit" scaling. */
function screenBox(overlay: HTMLElement | null, canvas: HTMLCanvasElement | null): Box | null {
  if (!overlay || !canvas) return null;
  const outer = overlay.getBoundingClientRect();
  const inner = canvas.getBoundingClientRect();
  if (inner.width === 0 || inner.height === 0) return null;
  return {
    left: inner.left - outer.left,
    top: inner.top - outer.top,
    width: inner.width,
    height: inner.height,
  };
}

const swallow = (event: React.SyntheticEvent): void => {
  event.stopPropagation();
  event.preventDefault();
};

/**
 * Covers the remote screen while the AI is working, so a stray click or key press can't get in
 * its way. "Take over" stops the run and gives the desktop back. While an action waits for
 * approval, a crosshair shows where it would land.
 */
export function RdpAgentOverlay({
  sessionId,
  getRemoteElement,
  getCanvas,
}: {
  sessionId: string;
  /** The `<iron-remote-desktop>` element, which takes keyboard input whenever it has focus. */
  getRemoteElement: () => HTMLElement | null;
  /** The canvas the remote screen is drawn on, to place the marker on the picture itself. */
  getCanvas?: () => HTMLCanvasElement | null;
}): React.JSX.Element | null {
  const state = useRdpAgentSession(sessionId);
  const active = isRdpAgentActive(state);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const target = state?.phase === 'proposed' ? state.target : undefined;

  // The element reads keys from the window whenever it is the focused element, so covering it
  // isn't enough: focus moves to the overlay, and is taken back if anything hands it over.
  useEffect(() => {
    if (!active) return;
    const holdFocus = (): void => {
      const remote = getRemoteElement();
      const focused = document.activeElement;
      if (remote && focused && (focused === remote || remote.contains(focused))) {
        (focused as HTMLElement).blur();
        overlayRef.current?.focus({ preventScroll: true });
      }
    };
    holdFocus();
    if (!getRemoteElement()) overlayRef.current?.focus({ preventScroll: true });
    document.addEventListener('focusin', holdFocus, true);
    return () => document.removeEventListener('focusin', holdFocus, true);
  }, [active, getRemoteElement]);

  useLayoutEffect(() => {
    if (!active || !target) return;
    const measure = (): void => setBox(screenBox(overlayRef.current, getCanvas?.() ?? null));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, target, getCanvas]);

  if (!active) return null;

  return (
    <div
      ref={overlayRef}
      data-testid="rdp-agent-overlay"
      tabIndex={-1}
      className="absolute inset-0 z-20 cursor-not-allowed outline-none"
      onPointerDown={swallow}
      onPointerUp={swallow}
      onMouseDown={swallow}
      onMouseUp={swallow}
      onClick={swallow}
      onDoubleClick={swallow}
      onContextMenu={swallow}
      onWheel={(event) => event.stopPropagation()}
      onKeyDown={swallow}
      onKeyUp={swallow}
    >
      {target && (
        <div
          className="pointer-events-none absolute"
          style={box ?? { left: 0, top: 0, width: '100%', height: '100%' }}
        >
          <div
            data-testid="rdp-agent-target"
            className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
          >
            <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/60" />
            <span className="absolute inset-1 rounded-full border-2 border-primary shadow-[0_0_0_2px_rgb(0_0_0/0.5)]" />
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-primary" />
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-primary" />
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 cursor-default items-center gap-3 rounded-full border border-border bg-background/95 py-1.5 pl-4 pr-1.5 text-xs shadow-xl backdrop-blur">
        <Robot className="h-3.5 w-3.5 animate-pulse text-primary" />
        <span className="text-foreground/85">The AI is using this desktop</span>
        <Button
          size="sm"
          className="h-7 rounded-full"
          // The overlay swallows clicks, so the button acts on its own pointer events.
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            stopRdpAgentTask(sessionId);
          }}
        >
          <StopCircle className="h-3 w-3" />
          Take over
        </Button>
      </div>
    </div>
  );
}
