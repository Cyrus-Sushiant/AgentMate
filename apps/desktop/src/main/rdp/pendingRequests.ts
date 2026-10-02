import { randomUUID } from 'node:crypto';

/**
 * Requests sent to another process that answers later by id, each with its own deadline. Kept
 * free of Electron so the timing can be tested on its own. The key groups requests (one Remote
 * Desktop session each) so a closing window can fail all of its requests at once.
 */

export type PendingResult<T = unknown> = { ok: true; value: T } | { ok: false; error: string };

interface Entry {
  key: string;
  timer: ReturnType<typeof setTimeout>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export interface PendingRequests {
  /** Sends a request through `send` and resolves with whatever settles its id. */
  request<T>(key: string, send: (requestId: string) => void, timeoutMs: number): Promise<T>;
  /** False when the id is unknown or already settled (a late answer after its timeout). */
  settle(requestId: string, result: PendingResult): boolean;
  /** Fails every request still waiting under `key`. */
  rejectAll(key: string, reason: string): void;
  /** The key a waiting request was sent under, or null once it is settled. */
  keyOf(requestId: string): string | null;
  size(): number;
}

export function createPendingRequests(): PendingRequests {
  const entries = new Map<string, Entry>();

  function take(requestId: string): Entry | null {
    const entry = entries.get(requestId);
    if (!entry) return null;
    entries.delete(requestId);
    clearTimeout(entry.timer);
    return entry;
  }

  return {
    request<T>(key: string, send: (requestId: string) => void, timeoutMs: number): Promise<T> {
      const requestId = randomUUID();
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!take(requestId)) return;
          reject(new Error(`The Remote Desktop window did not answer within ${timeoutMs} ms.`));
        }, timeoutMs);
        entries.set(requestId, {
          key,
          timer,
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        try {
          send(requestId);
        } catch (error) {
          take(requestId);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },

    settle(requestId, result) {
      const entry = take(requestId);
      if (!entry) return false;
      if (result.ok) entry.resolve(result.value);
      else entry.reject(new Error(result.error));
      return true;
    },

    rejectAll(key, reason) {
      for (const [requestId, entry] of [...entries]) {
        if (entry.key !== key) continue;
        take(requestId);
        entry.reject(new Error(reason));
      }
    },

    keyOf(requestId) {
      return entries.get(requestId)?.key ?? null;
    },

    size() {
      return entries.size;
    },
  };
}
