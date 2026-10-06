import { describe, expect, it } from 'vitest';
import { compareVersions, lastSeenText, siteHost, wpProblem } from './messages';

/** The words behind WordPress failures, and the small helpers the site pages lean on. */

describe('wpProblem', () => {
  it('turns a tagged failure into plain words without the tag or the IPC wrapper', () => {
    const text = wpProblem(
      new Error(
        "Error invoking remote method 'deployWordPress:siteInfo': Error: [wp:readOnly] 403",
      ),
    );
    expect(text).toBe('Read-only key. You can pull files from this site but not deploy to it.');
  });

  it('points to the Connect dialog for fixes made there', () => {
    expect(wpProblem(new Error('[wp:httpAuthRequired] 401'), 'connect')).toMatch(/below/);
    expect(wpProblem(new Error('[wp:httpAuthRequired] 401'))).toMatch(/in Access/);
  });

  it('keeps the words of a failure it has no code for', () => {
    expect(wpProblem(new Error('disk is gone'))).toBe('disk is gone');
  });

  it('never leaves a code tag or an em dash in a message', () => {
    for (const code of ['busy', 'syntaxError', 'bodyTooLarge', 'tlsUntrusted', 'internal']) {
      const text = wpProblem(new Error(`[wp:${code}] x`));
      expect(text).not.toContain('[wp:');
      expect(text).not.toContain(String.fromCharCode(0x2014));
    }
  });
});

describe('helpers', () => {
  it('compares dotted versions as numbers', () => {
    expect(compareVersions('1.0.9', '1.0.10')).toBe(-1);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('2.0.0-beta', '1.9.9')).toBe(1);
  });

  it('shortens a site address for the rail', () => {
    expect(siteHost('https://bakery.example/')).toBe('bakery.example');
    expect(siteHost('http://x.example:8080/blog/')).toBe('x.example:8080/blog');
    expect(siteHost('not a url')).toBe('not a url');
  });

  it('says when a site was last reached', () => {
    const now = Date.now();
    expect(lastSeenText({ lastSeenAt: null }, now)).toBe('Not reached yet');
    expect(lastSeenText({ lastSeenAt: now - 3 * 3_600_000 }, now)).toBe('Seen 3h ago');
  });
});
