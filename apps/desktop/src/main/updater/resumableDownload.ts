import { createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { type ClientRequest, type IncomingMessage, net } from 'electron';

/** Give up on a stalled socket after this long with no bytes, then Range-resume. */
const STALL_MS = 45_000;
const MAX_BACKOFF_MS = 20_000;

export class DownloadAbortedError extends Error {
  constructor() {
    super('Download paused.');
    this.name = 'DownloadAbortedError';
  }
}

export class DownloadFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DownloadFatalError';
  }
}

export interface ResumableDownloadProgress {
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface ResumableDownloadOptions {
  url: string;
  destPath: string;
  expectedSize: number | null;
  userAgent: string;
  onProgress: (progress: ResumableDownloadProgress) => void;
  onReconnect: (attempt: number, transferred: number) => void;
}

/**
 * Downloads `url` to `destPath`, appending when a partial file is already
 * there. Timeouts and dropped connections keep the bytes on disk and retry
 * with a Range request instead of starting over.
 */
export class ResumableDownload {
  private aborted = false;
  private request: ClientRequest | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;

  abort(): void {
    this.aborted = true;
    this.clearStall();
    try {
      this.request?.abort();
    } catch {
      // Already closed.
    }
  }

  get wasAborted(): boolean {
    return this.aborted;
  }

  async run(options: ResumableDownloadOptions): Promise<void> {
    this.aborted = false;
    let attempt = 0;

    for (;;) {
      if (this.aborted) throw new DownloadAbortedError();

      const existing = await fileSize(options.destPath);
      if (options.expectedSize != null && existing > options.expectedSize) {
        throw new DownloadFatalError(
          'Partial download is larger than the published installer. Delete it and try again.',
        );
      }
      if (options.expectedSize != null && existing === options.expectedSize && existing > 0) {
        return;
      }

      try {
        await this.downloadOnce(options, existing);
        const finalSize = await fileSize(options.destPath);
        if (options.expectedSize != null && finalSize < options.expectedSize) {
          throw new Error(`Download ended early (${finalSize} of ${options.expectedSize} bytes).`);
        }
        return;
      } catch (error) {
        if (this.aborted || error instanceof DownloadAbortedError) {
          throw new DownloadAbortedError();
        }
        if (error instanceof DownloadFatalError) throw error;
        attempt += 1;
        const transferred = await fileSize(options.destPath);
        options.onReconnect(attempt, transferred);
        await sleep(backoffMs(attempt));
      }
    }
  }

  private downloadOnce(options: ResumableDownloadOptions, startAt: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let stream: ReturnType<typeof createWriteStream> | null = null;

      const finish = (error: Error | null): void => {
        if (settled) return;
        settled = true;
        this.clearStall();
        this.request = null;
        if (error) reject(error);
        else resolve();
      };

      const endStream = (error: Error | null): void => {
        if (stream == null || stream.destroyed || stream.writableEnded) {
          finish(error);
          return;
        }
        stream.end(() => finish(error));
      };

      const request = net.request({
        method: 'GET',
        url: options.url,
        redirect: 'follow',
      });
      this.request = request;
      request.setHeader('User-Agent', options.userAgent);
      request.setHeader('Accept', '*/*');
      request.setHeader('Cache-Control', 'no-cache');
      if (startAt > 0) request.setHeader('Range', `bytes=${startAt}-`);

      request.on('response', (response: IncomingMessage) => {
        const status = response.statusCode ?? 0;
        if (status === 404 || status === 403 || status === 410) {
          finish(
            new DownloadFatalError(
              `Update file returned HTTP ${status}. The release asset may have been removed.`,
            ),
          );
          return;
        }
        if (status === 416) {
          finish(new Error('Server rejected the resume range. Retrying the remaining bytes.'));
          return;
        }
        if (status !== 200 && status !== 206) {
          finish(new Error(`Unexpected HTTP ${status} while downloading the update.`));
          return;
        }

        // Server ignored Range and sent the whole file. Overwrite the partial.
        const append = startAt > 0 && status === 206;
        const origin = append ? startAt : 0;
        stream = createWriteStream(options.destPath, { flags: append ? 'a' : 'w' });
        stream.on('error', (error) => {
          try {
            request.abort();
          } catch {
            // Already closed.
          }
          finish(error);
        });

        const contentLength = headerNumber(response.headers['content-length']);
        const rangeTotal = parseContentRangeTotal(headerString(response.headers['content-range']));
        let total = options.expectedSize ?? 0;
        if (rangeTotal != null) total = rangeTotal;
        else if (contentLength != null) total = origin + contentLength;
        if (options.expectedSize != null) total = options.expectedSize;

        let received = 0;
        const speedWindow: Array<{ at: number; bytes: number }> = [];
        const bumpProgress = (): void => {
          const transferred = origin + received;
          const now = Date.now();
          speedWindow.push({ at: now, bytes: transferred });
          while (speedWindow.length > 1 && now - speedWindow[0].at > 2000) {
            speedWindow.shift();
          }
          let bytesPerSecond = 0;
          if (speedWindow.length >= 2) {
            const first = speedWindow[0];
            const elapsed = (now - first.at) / 1000;
            if (elapsed > 0) bytesPerSecond = (transferred - first.bytes) / elapsed;
          }
          if (total < transferred) total = transferred;
          options.onProgress({ transferred, total, bytesPerSecond });
        };

        const armStall = (): void => {
          this.clearStall();
          this.stallTimer = setTimeout(() => {
            const error = new Error('Connection stalled. Resuming from the bytes already saved.');
            try {
              request.abort();
            } catch {
              // Already closed.
            }
            endStream(error);
          }, STALL_MS);
        };

        bumpProgress();
        armStall();

        response.on('data', (chunk: Buffer) => {
          received += chunk.length;
          armStall();
          if (stream && !stream.write(chunk)) {
            const body = response as unknown as {
              pause: () => void;
              resume: () => void;
            };
            body.pause();
            stream.once('drain', () => body.resume());
          }
          bumpProgress();
        });
        response.on('end', () => {
          this.clearStall();
          endStream(null);
        });
        response.on('error', (error) => endStream(error));
        response.on('aborted', () => {
          endStream(this.aborted ? new DownloadAbortedError() : new Error('Download aborted.'));
        });
      });

      request.on('error', (error) => {
        endStream(this.aborted ? new DownloadAbortedError() : error);
      });
      request.on('abort', () => {
        endStream(this.aborted ? new DownloadAbortedError() : new Error('Download aborted.'));
      });

      request.end();
    });
  }

  private clearStall(): void {
    if (this.stallTimer != null) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }
}

export async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

function backoffMs(attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, 1500 * 2 ** Math.min(attempt - 1, 5));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function headerString(value: string | string[] | undefined): string | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[value.length - 1] ?? null) : value;
}

function headerNumber(value: string | string[] | undefined): number | null {
  const raw = headerString(value);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseContentRangeTotal(header: string | null): number | null {
  if (header == null) return null;
  const match = /\/(\d+)\s*$/.exec(header);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
