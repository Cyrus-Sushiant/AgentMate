import { createHash } from 'node:crypto';

export interface ClipboardPort {
  readText(): string;
  writeText(text: string): void;
}

const digest = (text: string) => createHash('sha256').update(text, 'utf-8').digest('hex');

/**
 * Copies a secret and clears it again later, but only if the clipboard still holds it. If the
 * user copied something else in the meantime, that stays put. Only a hash of the secret is
 * kept, so this object never holds the plaintext.
 */
export class ClipboardGuard {
  private pendingHash: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly clipboard: ClipboardPort,
    private readonly onSettled: (result: { cleared: boolean }) => void,
  ) {}

  copy(text: string, clearAfterMs: number | null): { clearsAt: number | null } {
    this.cancelTimer();
    this.clipboard.writeText(text);
    if (clearAfterMs === null) {
      this.pendingHash = null;
      return { clearsAt: null };
    }
    this.pendingHash = digest(text);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.settle();
    }, clearAfterMs);
    return { clearsAt: Date.now() + clearAfterMs };
  }

  /** Clears now if the copied secret is still there. Returns whether it cleared. */
  clearIfOurs(): boolean {
    if (!this.pendingHash) return false;
    this.cancelTimer();
    return this.settle();
  }

  dispose(): void {
    this.cancelTimer();
    this.pendingHash = null;
  }

  private settle(): boolean {
    const ours =
      this.pendingHash !== null && digest(this.clipboard.readText()) === this.pendingHash;
    this.pendingHash = null;
    if (ours) this.clipboard.writeText('');
    this.onSettled({ cleared: ours });
    return ours;
  }

  private cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  toJSON(): Record<string, unknown> {
    return { pending: this.pendingHash !== null };
  }
}
