import { describe, expect, it } from 'vitest';
import {
  normalizeVaultAutoLockMinutes,
  normalizeVaultClipboardClearSeconds,
  VAULT_AUTO_LOCK_CHOICES,
  VAULT_CLIPBOARD_CLEAR_CHOICES,
} from './settings.js';

describe('vault settings', () => {
  it('keeps any offered auto-lock choice, including never', () => {
    for (const minutes of VAULT_AUTO_LOCK_CHOICES) {
      expect(normalizeVaultAutoLockMinutes(minutes)).toBe(minutes);
    }
    expect(VAULT_AUTO_LOCK_CHOICES).toContain(0);
  });

  it('falls back to 15 minutes for anything else', () => {
    for (const bad of [undefined, null, -1, 7, Number.NaN, '15', 1e9]) {
      expect(normalizeVaultAutoLockMinutes(bad)).toBe(15);
    }
  });

  it('keeps any offered clipboard choice and falls back to 30 seconds', () => {
    for (const seconds of VAULT_CLIPBOARD_CLEAR_CHOICES) {
      expect(normalizeVaultClipboardClearSeconds(seconds)).toBe(seconds);
    }
    expect(normalizeVaultClipboardClearSeconds(45)).toBe(30);
    expect(normalizeVaultClipboardClearSeconds(undefined)).toBe(30);
  });
});
