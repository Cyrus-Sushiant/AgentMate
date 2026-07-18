import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * One-time pairing tokens. Every time the operator generates a pairing code a
 * brand-new token is minted; it is single-use (consumed on the first successful
 * pair) and expires after a short window, so a leaked code can't be replayed.
 */
export class TokenStore {
  private tokens = new Map<string, { expiresAt: number }>();

  /** Mint a fresh token. Any previously issued (still-pending) token is discarded. */
  issue(ttlMs = 5 * 60 * 1000): { token: string; expiresAt: number } {
    this.tokens.clear();
    const token = randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + ttlMs;
    this.tokens.set(token, { expiresAt });
    return { token, expiresAt };
  }

  /** Validate and consume a token. Returns true only for a live, unused token. */
  consume(candidate: string): boolean {
    this.prune();
    for (const [token, meta] of this.tokens) {
      if (meta.expiresAt < Date.now()) continue;
      if (constantTimeEqual(token, candidate)) {
        this.tokens.delete(token);
        return true;
      }
    }
    return false;
  }

  clear(): void {
    this.tokens.clear();
  }

  private prune(): void {
    const now = Date.now();
    for (const [token, meta] of this.tokens) {
      if (meta.expiresAt < now) this.tokens.delete(token);
    }
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
