import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOUDFLARE_API, createCloudflareApi } from './client';
import { ALL_GRANTS, createFakeCloudflare } from './testing/fakeCloudflare';

/**
 * The SDK client the Cloudflare page uses. It must talk to Cloudflare and nobody else, with only
 * the token it was given: the SDK would otherwise pick up a base URL, a Global API Key or an email
 * from the environment, and log to the console.
 */

const TOKEN = 'Gm4pR2e6Tq9VxYb1Lk0NsHjW3cZaDf7U8iOoPl5M';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createCloudflareApi', () => {
  it('sends the token as a bearer header to the API, whatever the environment says', async () => {
    vi.stubEnv('CLOUDFLARE_BASE_URL', 'https://attacker.example/client/v4');
    vi.stubEnv('CLOUDFLARE_API_KEY', 'not-ours');
    vi.stubEnv('CLOUDFLARE_EMAIL', 'someone@example.com');
    const fake = createFakeCloudflare({ tokens: { [TOKEN]: { grants: ALL_GRANTS } } });
    const api = createCloudflareApi(TOKEN, { fetch: fake.fetch, maxRetries: 0 });

    const verified = await api.user.tokens.verify();

    expect(verified.status).toBe('active');
    const [request] = fake.requests;
    expect(request.path).toBe('/user/tokens/verify');
    expect(request.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(request.headers.get('x-auth-key')).toBeNull();
    expect(request.headers.get('x-auth-email')).toBeNull();
    expect(CLOUDFLARE_API).toBe('https://api.cloudflare.com/client/v4');
  });

  it('logs nothing, even when a request fails', async () => {
    const console = [
      vi.spyOn(globalThis.console, 'log').mockImplementation(() => undefined),
      vi.spyOn(globalThis.console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(globalThis.console, 'error').mockImplementation(() => undefined),
      vi.spyOn(globalThis.console, 'debug').mockImplementation(() => undefined),
      vi.spyOn(globalThis.console, 'info').mockImplementation(() => undefined),
    ];
    vi.stubEnv('CLOUDFLARE_LOG', 'debug');
    const fake = createFakeCloudflare({ tokens: {} });
    const api = createCloudflareApi(TOKEN, { fetch: fake.fetch, maxRetries: 0 });

    await expect(api.user.tokens.verify()).rejects.toThrow();

    for (const spy of console) expect(spy).not.toHaveBeenCalled();
  });

  it('reaches the current global fetch when none is passed, so the proxy setting applies', async () => {
    const fake = createFakeCloudflare({ tokens: { [TOKEN]: { grants: ALL_GRANTS } } });
    vi.stubGlobal('fetch', fake.fetch);
    const api = createCloudflareApi(TOKEN, { maxRetries: 0 });

    await api.user.tokens.verify();

    expect(fake.requests).toHaveLength(1);
  });
});
