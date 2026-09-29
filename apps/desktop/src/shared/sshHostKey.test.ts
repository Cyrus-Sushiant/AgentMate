import { describe, expect, it } from 'vitest';
import { formatHostKeyFingerprint, isHostKeyFingerprint } from './sshHostKey';

/**
 * ssh2 reports a host key fingerprint as hex, but people compare it with what OpenSSH prints
 * (`ssh-keygen -lf`), which is "SHA256:" and unpadded base64. Show it the way they will check it.
 */
describe('host key fingerprints', () => {
  const hex = 'a3f1c2d4e5b60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00';

  it('formats a hex SHA-256 digest the way OpenSSH prints it', () => {
    const formatted = formatHostKeyFingerprint(hex);

    expect(formatted).toBe(
      `SHA256:${Buffer.from(hex, 'hex').toString('base64').replace(/=+$/, '')}`,
    );
    expect(formatted).not.toContain('=');
  });

  it('recognizes a well-formed fingerprint and nothing else', () => {
    expect(isHostKeyFingerprint(hex)).toBe(true);
    expect(isHostKeyFingerprint(hex.toUpperCase())).toBe(false);
    expect(isHostKeyFingerprint(hex.slice(2))).toBe(false);
    expect(isHostKeyFingerprint(`${hex}00`)).toBe(false);
    expect(isHostKeyFingerprint('not a fingerprint')).toBe(false);
    expect(isHostKeyFingerprint(42)).toBe(false);
  });

  it('shows anything that is not a fingerprint unchanged rather than inventing one', () => {
    expect(formatHostKeyFingerprint('unknown')).toBe('unknown');
  });
});
