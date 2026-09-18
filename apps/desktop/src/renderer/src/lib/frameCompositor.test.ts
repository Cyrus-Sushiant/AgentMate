import { encodeScreenTile } from '@shared/remoteProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawTile } from './frameCompositor';

const close = vi.fn();
const blobs: Blob[] = [];

function installImageBitmap(): void {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (blob: Blob) => {
      blobs.push(blob);
      return { close, width: 0, height: 0 } as unknown as ImageBitmap;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  blobs.length = 0;
  close.mockClear();
});

function tileBytes(patch: Partial<Parameters<typeof encodeScreenTile>[0]> = {}): Uint8Array {
  return encodeScreenTile({
    frameId: 7,
    x: 64,
    y: 128,
    w: 32,
    h: 16,
    jpeg: new Uint8Array([1, 2, 3, 4]),
    ...patch,
  });
}

describe('drawTile', () => {
  it('paints the decoded tile at the position it came with', async () => {
    installImageBitmap();
    const drawImage = vi.fn();
    const ctx = { drawImage } as unknown as CanvasRenderingContext2D;
    await drawTile(ctx, tileBytes());
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage.mock.calls[0].slice(1)).toEqual([64, 128, 32, 16]);
  });

  it('decodes the tile as a JPEG', async () => {
    installImageBitmap();
    await drawTile({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D, tileBytes());
    expect(blobs[0].type).toBe('image/jpeg');
    expect(blobs[0].size).toBe(4);
  });

  it('copies the bytes out of the IPC-owned view before handing them to a Blob', async () => {
    installImageBitmap();
    const bytes = tileBytes();
    await drawTile({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D, bytes);
    // Overwriting the incoming buffer afterwards must not change what was decoded.
    bytes.fill(0);
    expect(await blobs[0].arrayBuffer()).toEqual(new Uint8Array([1, 2, 3, 4]).buffer);
  });

  it('releases the bitmap once it has been painted', async () => {
    installImageBitmap();
    await drawTile({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D, tileBytes());
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('paints tiles independently, in whatever order they decode', async () => {
    installImageBitmap();
    const drawImage = vi.fn();
    const ctx = { drawImage } as unknown as CanvasRenderingContext2D;
    await Promise.all([
      drawTile(ctx, tileBytes({ x: 0, y: 0 })),
      drawTile(ctx, tileBytes({ x: 320, y: 240 })),
    ]);
    const positions = drawImage.mock.calls.map((call) => [call[1], call[2]]);
    expect(positions).toContainEqual([0, 0]);
    expect(positions).toContainEqual([320, 240]);
  });
});
