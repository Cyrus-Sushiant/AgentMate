import { describe, expect, it } from 'vitest';
import {
  cloudflareErrorCode,
  cloudflareErrorMessage,
  cloudflareErrorPermission,
  encodeCloudflareError,
} from './cloudflareErrors';

/** Electron only carries a message across IPC, so the code (and a permission) ride inside it. */

function overIpc(message: string): Error {
  return new Error(`Error invoking remote method 'cloudflare:createRecord': Error: ${message}`);
}

describe('Cloudflare errors over IPC', () => {
  it('keeps the code and the permission a refusal was about', () => {
    const error = overIpc(
      encodeCloudflareError('missing-permission', 'This token is not allowed to.', 'dns'),
    );
    expect(cloudflareErrorCode(error)).toBe('missing-permission');
    expect(cloudflareErrorPermission(error)).toBe('dns');
    expect(cloudflareErrorMessage(error)).toBe('This token is not allowed to.');
  });

  it('carries codes without a permission too', () => {
    const error = overIpc(encodeCloudflareError('token-rejected', 'Cloudflare refused it.'));
    expect(cloudflareErrorCode(error)).toBe('token-rejected');
    expect(cloudflareErrorPermission(error)).toBeNull();
    expect(cloudflareErrorMessage(error)).toBe('Cloudflare refused it.');
    expect(cloudflareErrorCode(new Error(encodeCloudflareError('locked', 'Locked.')))).toBe(
      'locked',
    );
    expect(cloudflareErrorCode(encodeCloudflareError('no-token', 'None.'))).toBe('no-token');
  });

  it('leaves plain errors alone and ignores tags it does not know', () => {
    expect(cloudflareErrorCode(new Error('Something else'))).toBeNull();
    expect(cloudflareErrorCode(new Error('[cloudflare:made-up] x'))).toBeNull();
    expect(cloudflareErrorPermission(new Error('[cloudflare:missing-permission:billing] x'))).toBe(
      null,
    );
    expect(cloudflareErrorMessage(overIpc('Cloudflare took too long.'))).toBe(
      'Cloudflare took too long.',
    );
  });
});
