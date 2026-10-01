import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  PermissionDeniedError,
} from 'cloudflare/core/error';
import { describe, expect, it } from 'vitest';
import {
  cloudflareErrorCode,
  cloudflareErrorMessage,
  cloudflareErrorPermission,
} from '../../../shared/cloudflareErrors';
import { cloudflareFailure } from './errors';

/**
 * What the page shows when a Cloudflare call fails: Cloudflare's own words, never the SDK's raw
 * message (it is the whole response body as JSON), and never the token.
 */

const TOKEN = 'Gm4pR2e6Tq9VxYb1Lk0NsHjW3cZaDf7U8iOoPl5M';

function apiError(status: number, errors: Array<{ code: number; message: string }>) {
  return APIError.generate(
    status,
    { success: false, errors, messages: [], result: null },
    undefined,
    new Headers(),
  );
}

describe('cloudflareFailure', () => {
  it("passes Cloudflare's own messages on, with their codes", () => {
    const failure = cloudflareFailure(
      apiError(400, [
        { code: 81053, message: 'An A, AAAA, or CNAME record with that host already exists.' },
      ]),
      TOKEN,
    );
    expect(failure.message).toBe(
      'Cloudflare said: An A, AAAA, or CNAME record with that host already exists. (code 81053)',
    );
  });

  it('names the permission a refused call needed, so the page can guide the fix', () => {
    const failure = cloudflareFailure(
      apiError(403, [{ code: 10000, message: 'Authentication error' }]),
      TOKEN,
      'dns',
    );
    expect(failure).toBeInstanceOf(Error);
    expect(cloudflareErrorCode(failure)).toBe('missing-permission');
    expect(cloudflareErrorPermission(failure)).toBe('dns');
    expect(cloudflareErrorMessage(failure)).toMatch(/add Zone > DNS > Edit/);
  });

  it('says the token is no longer accepted when Cloudflare answers 401', () => {
    const failure = cloudflareFailure(
      apiError(401, [{ code: 1000, message: 'Invalid API Token' }]),
      TOKEN,
    );
    expect(cloudflareErrorCode(failure)).toBe('token-rejected');
    expect(cloudflareErrorMessage(failure)).toMatch(/no longer accepts the saved token/);
  });

  it('turns network trouble and rate limits into plain advice', () => {
    expect(cloudflareFailure(new APIConnectionTimeoutError(), TOKEN).message).toMatch(
      /took too long/,
    );
    expect(
      cloudflareFailure(new APIConnectionError({ message: 'socket hang up' }), TOKEN).message,
    ).toMatch(/Could not reach Cloudflare/);
    expect(cloudflareFailure(apiError(429, []), TOKEN).message).toMatch(/Wait a minute/);
    expect(cloudflareFailure(apiError(503, []), TOKEN).message).toBe(
      'Cloudflare answered with status 503. Try again in a moment.',
    );
    expect(
      cloudflareFailure(
        new PermissionDeniedError(
          403,
          { errors: [{ code: 9109, message: 'Nope' }] },
          undefined,
          new Headers(),
        ),
        TOKEN,
      ).message,
    ).toBe('Cloudflare refused that: Nope (code 9109)');
  });

  it('never repeats the token, wherever it turned up', () => {
    const echoed = cloudflareFailure(
      apiError(400, [{ code: 6003, message: `Invalid request headers: Bearer ${TOKEN}` }]),
      TOKEN,
    );
    expect(echoed.message).not.toContain(TOKEN);
    expect(echoed.message).toContain('[token]');
    expect(cloudflareFailure(new Error(`boom ${TOKEN}`), TOKEN).message).toBe('boom [token]');
    expect(cloudflareFailure('plain text', TOKEN).message).toBe('plain text');
  });
});
