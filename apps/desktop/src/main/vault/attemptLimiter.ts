export interface AttemptLimiterOptions {
  /** Failures allowed back to back before any waiting starts. */
  freeFailures: number;
  baseMs: number;
  maxMs: number;
}

/**
 * Slows down password guessing in the running app. Offline guessing against the file is bounded
 * by scrypt instead, so it is fine that a restart forgets the count.
 */
export class AttemptLimiter {
  private failures = 0;
  private blockedUntil = 0;
  private baseMs: number;

  constructor(private readonly options: AttemptLimiterOptions) {
    this.baseMs = options.baseMs;
  }

  setBaseMs(baseMs: number): void {
    this.baseMs = baseMs;
  }

  retryAfterMs(now: number): number {
    return Math.max(0, this.blockedUntil - now);
  }

  recordFailure(now: number): void {
    this.failures++;
    const over = this.failures - this.options.freeFailures;
    if (over <= 0) return;
    const wait = Math.min(this.baseMs * 2 ** (over - 1), this.options.maxMs);
    this.blockedUntil = now + wait;
  }

  reset(): void {
    this.failures = 0;
    this.blockedUntil = 0;
  }
}
