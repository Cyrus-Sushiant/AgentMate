/** What `ssh:hostKeyStatus` reports: the key on record and the key the server presents now. */
export interface SshHostKeyStatus {
  serverId: string;
  nickname: string;
  host: string;
  port: number;
  /** Null when this server has never been connected to. */
  stored: string | null;
  presented: string;
}

/** A host key fingerprint as ssh2 reports it with `hostHash: 'sha256'`: 64 lowercase hex digits. */
const FINGERPRINT = /^[0-9a-f]{64}$/;

export function isHostKeyFingerprint(value: unknown): value is string {
  return typeof value === 'string' && FINGERPRINT.test(value);
}

/**
 * The fingerprint the way OpenSSH prints it (`ssh-keygen -lf`, the first-connect prompt):
 * "SHA256:" and unpadded base64. That is what someone will compare it against.
 */
export function formatHostKeyFingerprint(fingerprint: string): string {
  if (!isHostKeyFingerprint(fingerprint)) return fingerprint;
  let binary = '';
  for (let index = 0; index < fingerprint.length; index += 2) {
    binary += String.fromCharCode(Number.parseInt(fingerprint.slice(index, index + 2), 16));
  }
  return `SHA256:${btoa(binary).replace(/=+$/, '')}`;
}
