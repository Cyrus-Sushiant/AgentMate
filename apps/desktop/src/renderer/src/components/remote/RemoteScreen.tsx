import { useCallback, useEffect, useRef, useState } from 'react';
import type { RemoteMouseButton } from '@shared/remoteProtocol';
import type { RemoteScreenSize } from '@shared/apiTypes';
import { drawTile } from '@/lib/frameCompositor';
import { cn } from '@/lib/utils';

const BUTTON_MAP: Record<number, RemoteMouseButton> = { 0: 'left', 1: 'middle', 2: 'right' };
const MOVE_THROTTLE_MS = 16;

interface RemoteScreenProps {
  screen: RemoteScreenSize | null;
  /** True once fully connected — input is only forwarded then. */
  live: boolean;
}

/**
 * The controller's live view of the remote desktop. Incoming JPEG tiles are
 * painted onto a canvas sized to the host's capture surface; pointer, wheel and
 * keyboard events over the canvas are normalized and forwarded to the host.
 */
export function RemoteScreen({ screen, live }: RemoteScreenProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastMove = useRef(0);
  const [focused, setFocused] = useState(false);

  // (Re)size the drawing buffer whenever the host's screen dimensions change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !screen) return;
    canvas.width = screen.width;
    canvas.height = screen.height;
    ctxRef.current = canvas.getContext('2d');
  }, [screen]);

  // Paint incoming tiles.
  useEffect(() => {
    const unsub = window.agentmat.remote.onFrameTile((tile) => {
      const ctx = ctxRef.current;
      if (ctx) void drawTile(ctx, tile);
    });
    return unsub;
  }, []);

  const normalized = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!live) return;
      const now = performance.now();
      if (now - lastMove.current < MOVE_THROTTLE_MS) return;
      lastMove.current = now;
      const { x, y } = normalized(e);
      window.agentmat.remote.sendInput({ k: 'move', x, y });
    },
    [live, normalized],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!live) return;
      canvasRef.current?.focus();
      const button = BUTTON_MAP[e.button];
      if (!button) return;
      const { x, y } = normalized(e);
      window.agentmat.remote.sendInput({ k: 'down', x, y, button });
    },
    [live, normalized],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!live) return;
      const button = BUTTON_MAP[e.button];
      if (!button) return;
      const { x, y } = normalized(e);
      window.agentmat.remote.sendInput({ k: 'up', x, y, button });
    },
    [live, normalized],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!live) return;
      const { x, y } = normalized(e);
      // Normalize to "notches": pixel deltas (deltaMode 0) are divided down.
      const factor = e.deltaMode === 0 ? 100 : 1;
      window.agentmat.remote.sendInput({
        k: 'wheel',
        x,
        y,
        dx: e.deltaX / factor,
        dy: e.deltaY / factor,
      });
    },
    [live, normalized],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!live) return;
      e.preventDefault();
      const plainChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (plainChar) {
        window.agentmat.remote.sendInput({ k: 'text', text: e.key });
      } else {
        window.agentmat.remote.sendInput({ k: 'key', code: e.code, down: true });
      }
    },
    [live],
  );

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (!live) return;
      const plainChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (plainChar) return; // already handled as a one-shot text event
      e.preventDefault();
      window.agentmat.remote.sendInput({ k: 'key', code: e.code, down: false });
    },
    [live],
  );

  const aspect = screen ? screen.width / screen.height : 16 / 9;

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/60 p-2">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onContextMenu={(e) => e.preventDefault()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ aspectRatio: String(aspect) }}
        className={cn(
          'max-h-full max-w-full object-contain outline-none',
          live ? 'cursor-none' : 'cursor-default',
          focused ? 'ring-2 ring-primary' : 'ring-1 ring-border',
        )}
      />
    </div>
  );
}
