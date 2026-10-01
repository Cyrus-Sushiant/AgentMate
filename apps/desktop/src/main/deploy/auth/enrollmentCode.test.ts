import { createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CoreHttpError } from '../connection/coreHttp';
import type { CoreRest } from './coreSessions';
import { signMessage } from './deviceKey';
import { redeemEnrollmentCode } from './enrollmentCode';

/**
 * Redeeming an Owner's enrollment code: this computer makes its own key, and only the public half
 * goes to the core, with the code and the user's password. No SSH and no sudo are involved, which
 * is what lets someone without root on the server in.
 */

const PASSWORD = 'another long passphrase';

function core(answer: (path: string, body: unknown) => unknown) {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const rest: CoreRest = {
    post: async <T>(path: string, body: unknown): Promise<T> => {
      calls.push({ path, body: body as Record<string, unknown> });
      return answer(path, body) as T;
    },
  };
  return { rest, calls };
}

describe('redeemEnrollmentCode', () => {
  it('sends a fresh public key with the code and password, and keeps the private half here', async () => {
    const { rest, calls } = core(() => ({ deviceId: 'device-9' }));

    const enrolled = await redeemEnrollmentCode(rest, {
      code: '  abcde-fghij  ',
      userName: 'sam',
      password: PASSWORD,
      deviceName: ' Sam-PC ',
    });

    expect(enrolled.deviceId).toBe('device-9');
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('/api/v1/auth/enroll');
    expect(calls[0].body).toMatchObject({
      code: 'abcde-fghij',
      userName: 'sam',
      password: PASSWORD,
      deviceName: 'Sam-PC',
    });
    expect(JSON.stringify(calls)).not.toContain('PRIVATE KEY');
    // The key the core got is the one this computer signs with.
    const publicKey = createPublicKey({
      key: Buffer.from(String(calls[0].body.publicKey), 'base64'),
      format: 'der',
      type: 'spki',
    });
    const signature = Buffer.from(signMessage(enrolled.privateKeyPem, 'hello'), 'base64');
    expect(
      verify(
        'sha256',
        Buffer.from('hello'),
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        signature,
      ),
    ).toBe(true);
  });

  it("passes the core's refusal on with its code, so the dialog can say what to fix", async () => {
    const { rest } = core(() => {
      throw new CoreHttpError('refused', 401, {
        code: 'enrollmentCodeInvalid',
        message: 'That enrollment code is wrong, used or expired.',
      });
    });

    await expect(
      redeemEnrollmentCode(rest, {
        code: 'ABCDE',
        userName: 'sam',
        password: PASSWORD,
        deviceName: 'Sam-PC',
      }),
    ).rejects.toThrow(
      '[core:enrollmentCodeInvalid] That enrollment code is wrong, used or expired.',
    );
  });

  it('passes anything else on unchanged', async () => {
    const { rest } = core(() => {
      throw new Error('Could not open a tunnel');
    });

    await expect(
      redeemEnrollmentCode(rest, {
        code: 'ABCDE',
        userName: 'sam',
        password: PASSWORD,
        deviceName: 'Sam-PC',
      }),
    ).rejects.toThrow(/^Could not open a tunnel$/);
  });
});
