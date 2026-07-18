import { decodeScreenTile } from '@shared/remoteProtocol';

/**
 * Controller-side counterpart to {@link startScreenCapture}: decodes an
 * incoming JPEG tile and paints it at its position on the remote-screen canvas.
 * Tiles cover disjoint regions, so they can be drawn independently and in any
 * order as their bitmaps decode.
 */
export async function drawTile(
  ctx: CanvasRenderingContext2D,
  tileBytes: Uint8Array,
): Promise<void> {
  const tile = decodeScreenTile(tileBytes);
  // Copy into a standalone buffer so the Blob isn't tied to the IPC-owned view.
  const copy = new Uint8Array(tile.jpeg);
  const bitmap = await createImageBitmap(new Blob([copy], { type: 'image/jpeg' }));
  ctx.drawImage(bitmap, tile.x, tile.y, tile.w, tile.h);
  bitmap.close();
}
