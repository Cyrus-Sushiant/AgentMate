/** Calls `onExpire` once the vault has seen no activity for the armed period. */
export class IdleTimer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private periodMs: number | null = null;

  constructor(private readonly onExpire: () => void) {}

  /** `null` means never. */
  arm(periodMs: number | null): void {
    this.periodMs = periodMs;
    this.restart();
  }

  touch(): void {
    if (this.timer) this.restart();
  }

  stop(): void {
    this.periodMs = null;
    this.clear();
  }

  private restart(): void {
    this.clear();
    if (this.periodMs === null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onExpire();
    }, this.periodMs);
  }

  private clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
