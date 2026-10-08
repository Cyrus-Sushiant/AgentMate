import { createPublicKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { integer, objectIdentifier } from '../../deploy/directTls/clientCertificate';

/**
 * Self-signed RSA certificates shaped like the ones a Windows Server makes for Remote Desktop,
 * for tests. What matters is the Key Usage extension: Windows asks for Key Encipherment and Data
 * Encipherment only, with no Digital Signature, and that is what Electron's TLS stack (BoringSSL)
 * refuses for ECDHE and TLS 1.3. Node has no X.509 writer, so the DER is written here.
 */

export type KeyUsageProfile =
  /** What Windows makes: Key Encipherment and Data Encipherment. */
  | 'windows'
  /** Digital Signature, what most certificates from a CA carry. */
  | 'signature'
  /** No Key Usage extension at all. */
  | 'none';

const OID = {
  sha256WithRsa: '1.2.840.113549.1.1.11',
  commonName: '2.5.4.3',
  keyUsage: '2.5.29.15',
  extKeyUsage: '2.5.29.37',
  serverAuth: '1.3.6.1.5.5.7.3.1',
} as const;

function length(size: number): Buffer {
  if (size < 0x80) return Buffer.from([size]);
  const bytes: number[] = [];
  for (let rest = size; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest % 256);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, ...content: Buffer[]): Buffer {
  const body = Buffer.concat(content);
  return Buffer.concat([Buffer.from([tag]), length(body.length), body]);
}

const sequence = (...items: Buffer[]) => tlv(0x30, ...items);
const set = (...items: Buffer[]) => tlv(0x31, ...items);
const bitString = (unusedBits: number, value: Buffer) =>
  tlv(0x03, Buffer.from([unusedBits]), value);

function utcTime(at: Date): Buffer {
  const pad = (value: number) => String(value).padStart(2, '0');
  const text = `${pad(at.getUTCFullYear() % 100)}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}Z`;
  return tlv(0x17, Buffer.from(text, 'ascii'));
}

function extension(oid: string, critical: boolean, value: Buffer): Buffer {
  return sequence(
    objectIdentifier(oid),
    ...(critical ? [Buffer.from([0x01, 0x01, 0xff])] : []),
    tlv(0x04, value),
  );
}

function keyUsageExtension(profile: KeyUsageProfile): Buffer[] {
  switch (profile) {
    case 'windows':
      // keyEncipherment (bit 2) and dataEncipherment (bit 3): 0011 0000, 4 unused bits.
      return [extension(OID.keyUsage, true, bitString(4, Buffer.from([0x30])))];
    case 'signature':
      // digitalSignature (bit 0): 1000 0000, 7 unused bits.
      return [extension(OID.keyUsage, true, bitString(7, Buffer.from([0x80])))];
    case 'none':
      return [];
  }
}

export interface TestCertificate {
  /** PEM, for `tls.createServer({ cert })`. */
  cert: string;
  /** PEM, for `tls.createServer({ key })`. */
  key: string;
}

export function rdpStyleCertificate(
  profile: KeyUsageProfile,
  commonName = 'WIN-RDP-TEST',
  now = new Date(),
): TestCertificate {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyInfo = createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  const algorithm = sequence(objectIdentifier(OID.sha256WithRsa), Buffer.from([0x05, 0x00]));
  const name = sequence(
    set(sequence(objectIdentifier(OID.commonName), tlv(0x0c, Buffer.from(commonName)))),
  );
  const serial = randomBytes(16);
  serial.writeUInt8(serial.readUInt8(0) & 0x7f, 0);
  const tbs = sequence(
    tlv(0xa0, integer(Buffer.from([2]))),
    integer(serial),
    algorithm,
    name,
    sequence(
      utcTime(new Date(now.getTime() - 60 * 60_000)),
      utcTime(new Date(now.getTime() + 24 * 60 * 60_000)),
    ),
    name,
    publicKeyInfo,
    tlv(
      0xa3,
      sequence(
        ...keyUsageExtension(profile),
        extension(OID.extKeyUsage, false, sequence(objectIdentifier(OID.serverAuth))),
      ),
    ),
  );
  const der = sequence(tbs, algorithm, bitString(0, sign('sha256', tbs, privateKey)));
  const base64 = der.toString('base64');
  const lines: string[] = [];
  for (let at = 0; at < base64.length; at += 64) lines.push(base64.slice(at, at + 64));
  return {
    cert: `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`,
    key: privateKey.export({ format: 'pem', type: 'pkcs8' }) as string,
  };
}
