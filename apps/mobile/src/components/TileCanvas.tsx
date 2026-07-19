import { useCallback, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import type { RemoteInputEvent, RemoteMouseButton } from '@agentmat/protocol';
import type { RemoteTile } from '../remote/useRemoteClient';
import { colors } from '../theme';

interface RemoteScreenSize {
  width: number;
  height: number;
}

interface TileCanvasProps {
  screen: RemoteScreenSize | null;
  tiles: Map<string, RemoteTile>;
  live: boolean;
  onInput: (event: RemoteInputEvent) => void;
}

const LONG_PRESS_MS = 480;
const MOVE_SLOP = 6;
const WHEEL_DIVISOR = 24;

function touchAverageY(touches: GestureResponderEvent['nativeEvent']['touches']): number {
  const sum = touches.reduce((acc, t) => acc + t.pageY, 0);
  return sum / touches.length;
}

/**
 * Renders the host's screen as a mosaic of independently-updating JPEG tiles
 * (mirrors the desktop controller's canvas compositor — see
 * apps/desktop/src/renderer/src/lib/frameCompositor.ts — but React Native has
 * no <canvas>, so each tile is its own absolutely-positioned <Image>) and
 * translates touch gestures into the same normalized RemoteInputEvent stream
 * the desktop's RemoteScreen.tsx produces from mouse events.
 */
export function TileCanvas({ screen, tiles, live, onInput }: TileCanvasProps): React.JSX.Element {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const downButton = useRef<RemoteMouseButton | null>(null);
  const rightClickActive = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const twoFinger = useRef<{ lastY: number } | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const onLayoutHandler = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
  }, []);

  const aspect = screen ? screen.width / screen.height : 16 / 9;
  let canvasWidth = layout.width;
  let canvasHeight = layout.width / aspect;
  if (canvasHeight > layout.height && layout.height > 0) {
    canvasHeight = layout.height;
    canvasWidth = layout.height * aspect;
  }
  const scale = screen && canvasWidth > 0 ? canvasWidth / screen.width : 0;

  const normalize = useCallback(
    (x: number, y: number) => ({
      x: Math.min(1, Math.max(0, x / (canvasWidth || 1))),
      y: Math.min(1, Math.max(0, y / (canvasHeight || 1))),
    }),
    [canvasWidth, canvasHeight],
  );

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => live,
      onMoveShouldSetPanResponder: () => live,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          twoFinger.current = { lastY: touchAverageY(touches) };
          return;
        }
        const { locationX, locationY } = evt.nativeEvent;
        const pt = normalize(locationX, locationY);
        startPoint.current = pt;
        moved.current = false;
        longPressTimer.current = setTimeout(() => {
          if (startPoint.current && !moved.current) {
            rightClickActive.current = true;
            onInput({ k: 'down', x: pt.x, y: pt.y, button: 'right' });
          }
        }, LONG_PRESS_MS);
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          if (!twoFinger.current) twoFinger.current = { lastY: touchAverageY(touches) };
          const y = touchAverageY(touches);
          const dy = (twoFinger.current.lastY - y) / WHEEL_DIVISOR;
          twoFinger.current.lastY = y;
          if (Math.abs(dy) > 0.001) onInput({ k: 'wheel', x: 0.5, y: 0.5, dx: 0, dy });
          return;
        }
        if (!startPoint.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const pt = normalize(locationX, locationY);
        const dx = Math.abs(locationX - startPoint.current.x * canvasWidth);
        const dy = Math.abs(locationY - startPoint.current.y * canvasHeight);
        if (dx > MOVE_SLOP || dy > MOVE_SLOP) moved.current = true;

        if (rightClickActive.current) return;
        if (moved.current) {
          clearLongPress();
          if (!downButton.current) {
            downButton.current = 'left';
            onInput({ k: 'down', x: pt.x, y: pt.y, button: 'left' });
          } else {
            onInput({ k: 'move', x: pt.x, y: pt.y });
          }
        }
      },
      onPanResponderRelease: (evt) => {
        clearLongPress();
        if (twoFinger.current) {
          twoFinger.current = null;
          startPoint.current = null;
          return;
        }
        const { locationX, locationY } = evt.nativeEvent;
        const pt = normalize(locationX, locationY);
        if (rightClickActive.current) {
          onInput({ k: 'up', x: pt.x, y: pt.y, button: 'right' });
          rightClickActive.current = false;
        } else if (downButton.current) {
          onInput({ k: 'up', x: pt.x, y: pt.y, button: downButton.current });
          downButton.current = null;
        } else if (startPoint.current) {
          // A tap that never moved: fire a synthetic click.
          onInput({ k: 'down', x: pt.x, y: pt.y, button: 'left' });
          onInput({ k: 'up', x: pt.x, y: pt.y, button: 'left' });
        }
        startPoint.current = null;
      },
      onPanResponderTerminate: () => {
        clearLongPress();
        downButton.current = null;
        rightClickActive.current = false;
        twoFinger.current = null;
        startPoint.current = null;
      },
    }),
  ).current;

  return (
    <View style={styles.wrap} onLayout={onLayoutHandler}>
      <View
        style={[styles.canvas, { width: canvasWidth || undefined, height: canvasHeight || undefined }]}
        {...panResponder.panHandlers}
      >
        {screen &&
          Array.from(tiles.values()).map((tile) => (
            <Image
              key={`${tile.x},${tile.y}`}
              source={{ uri: tile.uri }}
              style={{
                position: 'absolute',
                left: tile.x * scale,
                top: tile.y * scale,
                width: tile.w * scale,
                height: tile.h * scale,
              }}
            />
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  canvas: {
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
});
