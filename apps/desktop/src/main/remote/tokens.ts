import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

/**
 * Two kinds of credentials:
 *
 * - Pairing tokens: minted when the operator generates a pairing code. Single
 *   use and short-lived, so a leaked QR code can't be replayed.
 * - Device tokens: minted when a controller successfully pairs. Durable and
 *   persisted to disk (`remote-devices.json` in userData), so a phone that
 *   paired once can reconnect later without scanning a new code. Stopping and
 *   restarting hosting does NOT invalidate them.
 */

export interface PairedDevice {
  token: string;
  deviceName: string;
  createdAt: number;
  lastSeenAt: number;
}

export class TokenStore {
  private pairing = new Map<string, { expiresAt: number }>();
  private devices: PairedDevice[] | null = null;

  /** Mint a fresh pairing token. Any previously issued (still-pending) token is discarded. */
  issue(ttlMs = 5 * 60 * 1000): { token: string; expiresAt: number } {
    this.pairing.clear();
    const token = randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + ttlMs;
    this.pairing.set(token, { expiresAt });
    return { token, expiresAt };
  }

  /** Validate and consume a pairing token. Returns true only for a live, unused token. */
  consume(candidate: string): boolean {
    this.prune();
    for (const [token, meta] of this.pairing) {
      if (meta.expiresAt < Date.now()) continue;
      if (constantTimeEqual(token, candidate)) {
        this.pairing.delete(token);
        return true;
      }
    }
    return false;
  }

  /**
   * Mint a durable token for a controller that just paired successfully. The
   * controller stores it and presents it on every reconnect.
   */
  issueDeviceToken(deviceName: string): string {
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    const devices = this.loadDevices();
    devices.push({ token, deviceName, createdAt: now, lastSeenAt: now });
    this.saveDevices();
    return token;
  }

  /** Validate a durable device token (without consuming it) and refresh its metadata. */
  validateDeviceToken(candidate: string, deviceName?: string): PairedDevice | null {
    for (const device of this.loadDevices()) {
      if (constantTimeEqual(device.token, candidate)) {
        device.lastSeenAt = Date.now();
        if (deviceName) device.deviceName = deviceName;
        this.saveDevices();
        return device;
      }
    }
    return null;
  }

  listDevices(): PairedDevice[] {
    return [...this.loadDevices()];
  }

  revokeDeviceToken(token: string): void {
    const devices = this.loadDevices();
    const next = devices.filter((d) => d.token !== token);
    if (next.length !== devices.length) {
      this.devices = next;
      this.saveDevices();
    }
  }

  /** Drop pending pairing tokens only. Paired devices survive host restarts. */
  clear(): void {
    this.pairing.clear();
  }

  private prune(): void {
    const now = Date.now();
    for (const [token, meta] of this.pairing) {
      if (meta.expiresAt < now) this.pairing.delete(token);
    }
  }

  // Lazily loaded because app.getPath('userData') is not available until the
  // Electron app is ready, and the TokenStore is constructed at import time.
  private storePath(): string {
    return join(app.getPath('userData'), 'remote-devices.json');
  }

  private loadDevices(): PairedDevice[] {
    if (this.devices) return this.devices;
    this.devices = [];
    try {
      const path = this.storePath();
      if (existsSync(path)) {
        const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
        if (Array.isArray(parsed)) {
          this.devices = parsed.filter(
            (d): d is PairedDevice =>
              typeof d === 'object' &&
              d !== null &&
              typeof (d as PairedDevice).token === 'string' &&
              typeof (d as PairedDevice).deviceName === 'string',
          );
        }
      }
    } catch {
      // A corrupt store just means everyone re-pairs.
    }
    return this.devices;
  }

  private saveDevices(): void {
    if (!this.devices) return;
    try {
      writeFileSync(this.storePath(), JSON.stringify(this.devices, null, 2), 'utf-8');
    } catch {
      // Persisting is best-effort; tokens still work for this session.
    }
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
