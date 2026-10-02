import { describe, expect, it, vi } from 'vitest';
import { checkGithubToken, GithubTokenRejectedError, readGhToken } from './github';

function reply(status: number, scopes: string | null, body: unknown = { login: 'octocat' }) {
  const headers = new Headers();
  if (scopes !== null) headers.set('x-oauth-scopes', scopes);
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers }));
}

describe('checkGithubToken', () => {
  it('reads the scopes GitHub reports and who the token belongs to', async () => {
    const fetch = reply(200, 'read:packages');
    const check = await checkGithubToken('ghp_packagesOnly0123456789', fetch);

    expect(check).toEqual({
      username: 'octocat',
      scopes: ['read:packages'],
      canPull: true,
      broaderScopes: [],
      problem: null,
    });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/user');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer ghp_packagesOnly0123456789',
    );
  });

  it('lists what a broader token can do besides pulling', async () => {
    const check = await checkGithubToken('ghp_broad', reply(200, 'repo, workflow, read:packages'));

    expect(check.canPull).toBe(true);
    expect(check.broaderScopes).toEqual(['repo', 'workflow']);
  });

  it('a token without packages comes back with the fix', async () => {
    const check = await checkGithubToken('ghp_repoOnly', reply(200, 'repo'));

    expect(check.canPull).toBe(false);
    expect(check.problem).toMatch(/read:packages/);
  });

  it('for the gh sign-in the fix is gh auth refresh', async () => {
    const check = await checkGithubToken('gho_cli', reply(200, 'repo, workflow, gist'), 'ghCli');

    expect(check.problem).toContain('gh auth refresh -h github.com -s read:packages');
  });

  it('refuses fine-grained tokens without asking GitHub', async () => {
    const fetch = reply(200, '');
    const check = await checkGithubToken('github_pat_11ABCDEFG', fetch);

    expect(fetch).not.toHaveBeenCalled();
    expect(check.canPull).toBe(false);
    expect(check.problem).toMatch(/classic/);
  });

  it('an answer without the scopes header cannot be trusted to pull', async () => {
    const check = await checkGithubToken('ghs_app', reply(200, null));

    expect(check.canPull).toBe(false);
    expect(check.problem).toMatch(/classic token/);
  });

  it('a token GitHub refuses is an error', async () => {
    await expect(checkGithubToken('ghp_revoked', reply(401, null))).rejects.toBeInstanceOf(
      GithubTokenRejectedError,
    );
    await expect(checkGithubToken('ghp_x', reply(500, null))).rejects.toThrow(/HTTP 500/);
  });

  it('says when GitHub cannot be reached', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    });
    await expect(checkGithubToken('ghp_x', fetch)).rejects.toThrow(/could not be reached/);
  });
});

describe('readGhToken', () => {
  it('asks gh for its github.com token', async () => {
    const run = vi.fn(async () => ({ stdout: 'gho_cliToken\n' }));
    expect(await readGhToken(run)).toEqual({ token: 'gho_cliToken', problem: null });
    expect(run).toHaveBeenCalledWith(['auth', 'token', '--hostname', 'github.com']);
  });

  it('says gh is missing or not signed in', async () => {
    const missing = Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' });
    expect(
      await readGhToken(async () => {
        throw missing;
      }),
    ).toEqual({ token: null, problem: expect.stringMatching(/not installed/) });
    expect(
      await readGhToken(async () => {
        throw new Error('no oauth token');
      }),
    ).toEqual({ token: null, problem: expect.stringMatching(/gh auth login/) });
    expect(await readGhToken(async () => ({ stdout: '  ' }))).toEqual({
      token: null,
      problem: expect.stringMatching(/not signed in/),
    });
  });
});
