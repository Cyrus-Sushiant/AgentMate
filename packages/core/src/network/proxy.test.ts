import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROXY_BYPASS,
  defaultProxySettings,
  isProxyActive,
  noProxyEnvValue,
  normalizeProxySettings,
  PROXY_MODES,
  PROXY_PROTOCOLS,
  type ProxySettings,
  proxyBypassRules,
  proxyEnvUrl,
  proxyServerUrl,
} from './proxy.js';

/**
 * Everything the app sends out goes through whatever this block says, and
 * settings.json is hand-editable, so a half-written manual entry has to fall back
 * to a direct connection rather than aiming every request at a host that is not
 * there. The credential encoding matters too: these URLs are read by git and by the
 * CLIs, which have no way to prompt.
 */

function manual(overrides: Partial<ProxySettings> = {}): ProxySettings {
  return {
    ...defaultProxySettings(),
    mode: 'manual',
    host: '10.0.0.1',
    port: 8080,
    ...overrides,
  };
}

describe('defaultProxySettings', () => {
  it('starts direct, with the loopback bypass', () => {
    expect(defaultProxySettings()).toEqual({
      mode: 'direct',
      protocol: 'http',
      host: '',
      port: null,
      username: '',
      password: '',
      bypassList: ['<local>'],
    });
  });

  it('hands out a fresh bypass array each time, so one caller cannot mutate the default', () => {
    const first = defaultProxySettings();
    first.bypassList.push('example.com');
    expect(defaultProxySettings().bypassList).toEqual([...DEFAULT_PROXY_BYPASS]);
  });
});

describe('normalizeProxySettings', () => {
  it('returns the defaults for a missing or non-object block', () => {
    expect(normalizeProxySettings(null)).toEqual(defaultProxySettings());
    expect(normalizeProxySettings(undefined)).toEqual(defaultProxySettings());
  });

  it('keeps every known mode and protocol', () => {
    for (const mode of PROXY_MODES) {
      // 'manual' needs a complete server or it is downgraded, so give it one.
      const value = normalizeProxySettings({ mode, host: '10.0.0.1', port: 8080 });
      expect(value.mode, mode).toBe(mode);
    }
    for (const protocol of PROXY_PROTOCOLS) {
      expect(normalizeProxySettings({ protocol }).protocol, protocol).toBe(protocol);
    }
  });

  it('falls back to direct/http for an unknown mode or protocol', () => {
    const value = normalizeProxySettings({
      mode: 'pac' as ProxySettings['mode'],
      protocol: 'socks6' as ProxySettings['protocol'],
    });
    expect(value.mode).toBe('direct');
    expect(value.protocol).toBe('http');
  });

  it('downgrades a manual entry that has no host or no port', () => {
    expect(normalizeProxySettings({ mode: 'manual', host: '', port: 8080 }).mode).toBe('direct');
    expect(normalizeProxySettings({ mode: 'manual', host: '10.0.0.1', port: null }).mode).toBe(
      'direct',
    );
  });

  it('leaves system mode alone even with no host, since the OS supplies one', () => {
    expect(normalizeProxySettings({ mode: 'system' }).mode).toBe('system');
  });

  it('rejects a port outside the valid range or one that is not a whole number', () => {
    for (const port of [0, -1, 65536, 80.5, Number.NaN]) {
      expect(normalizeProxySettings({ port }).port, String(port)).toBeNull();
    }
    expect(normalizeProxySettings({ port: 1 }).port).toBe(1);
    expect(normalizeProxySettings({ port: 65535 }).port).toBe(65535);
  });

  it('trims host and username but leaves the password byte for byte', () => {
    const value = normalizeProxySettings({
      host: '  proxy.corp  ',
      username: '  alice  ',
      password: '  p@ss  ',
    });
    expect(value.host).toBe('proxy.corp');
    expect(value.username).toBe('alice');
    // Trimming a password would silently change a credential that is legitimately padded.
    expect(value.password).toBe('  p@ss  ');
  });

  it('cleans the bypass list: drops blanks and non-strings, trims, and dedupes', () => {
    const value = normalizeProxySettings({
      bypassList: [
        ' <local> ',
        '<local>',
        '',
        '   ',
        '*.corp.example',
        42 as unknown as string,
        null as unknown as string,
      ],
    });
    expect(value.bypassList).toEqual(['<local>', '*.corp.example']);
  });

  it('restores the default bypass when the stored value is not an array', () => {
    expect(
      normalizeProxySettings({ bypassList: 'localhost' as unknown as string[] }).bypassList,
    ).toEqual([...DEFAULT_PROXY_BYPASS]);
  });

  it('is idempotent, since the block is normalized on every read', () => {
    const once = normalizeProxySettings(manual({ username: 'alice', password: 'p/w' }));
    expect(normalizeProxySettings(once)).toEqual(once);
  });
});

describe('isProxyActive', () => {
  it('is false for a direct connection', () => {
    expect(isProxyActive(defaultProxySettings())).toBe(false);
  });

  it('is true for system mode, where the OS decides', () => {
    expect(isProxyActive({ ...defaultProxySettings(), mode: 'system' })).toBe(true);
  });

  it('is true only for a manual entry that names both a host and a port', () => {
    expect(isProxyActive(manual())).toBe(true);
    expect(isProxyActive(manual({ host: '' }))).toBe(false);
    expect(isProxyActive(manual({ port: null }))).toBe(false);
  });
});

describe('proxyServerUrl', () => {
  it('builds protocol://host:port for a manual proxy', () => {
    expect(proxyServerUrl(manual())).toBe('http://10.0.0.1:8080');
    expect(proxyServerUrl(manual({ protocol: 'socks5', port: 1080 }))).toBe(
      'socks5://10.0.0.1:1080',
    );
  });

  it('leaves credentials out, because Chromium ignores them in a proxy rule', () => {
    expect(proxyServerUrl(manual({ username: 'alice', password: 'secret' }))).toBe(
      'http://10.0.0.1:8080',
    );
  });

  it('is null for direct and system mode, and for an incomplete manual entry', () => {
    expect(proxyServerUrl(defaultProxySettings())).toBeNull();
    expect(proxyServerUrl({ ...defaultProxySettings(), mode: 'system' })).toBeNull();
    expect(proxyServerUrl(manual({ host: '' }))).toBeNull();
    expect(proxyServerUrl(manual({ port: null }))).toBeNull();
  });
});

describe('proxyEnvUrl', () => {
  it('matches the server URL when no username is set', () => {
    expect(proxyEnvUrl(manual())).toBe('http://10.0.0.1:8080');
    // A password with no username is not a credential anything can use.
    expect(proxyEnvUrl(manual({ password: 'secret' }))).toBe('http://10.0.0.1:8080');
  });

  it('inserts the credentials after the scheme', () => {
    expect(proxyEnvUrl(manual({ username: 'alice', password: 'secret' }))).toBe(
      'http://alice:secret@10.0.0.1:8080',
    );
  });

  it('percent-encodes characters that would otherwise split the URL', () => {
    expect(proxyEnvUrl(manual({ username: 'corp\\alice', password: 'p@ss:w/rd?#' }))).toBe(
      'http://corp%5Calice:p%40ss%3Aw%2Frd%3F%23@10.0.0.1:8080',
    );
  });

  it('keeps an empty password as an empty field rather than dropping the colon', () => {
    expect(proxyEnvUrl(manual({ username: 'alice', password: '' }))).toBe(
      'http://alice:@10.0.0.1:8080',
    );
  });

  it('is null whenever there is no manual server', () => {
    expect(proxyEnvUrl(defaultProxySettings())).toBeNull();
    expect(proxyEnvUrl(manual({ port: null, username: 'alice' }))).toBeNull();
  });
});

describe('proxyBypassRules', () => {
  it('joins the rules with commas, keeping Chromium shorthand as is', () => {
    expect(proxyBypassRules({ ...defaultProxySettings(), bypassList: ['<local>', '*.corp'] })).toBe(
      '<local>,*.corp',
    );
  });

  it("is '' when nothing is bypassed", () => {
    expect(proxyBypassRules({ ...defaultProxySettings(), bypassList: [] })).toBe('');
  });
});

describe('noProxyEnvValue', () => {
  it('expands <local> into the loopback names the CLIs understand', () => {
    expect(noProxyEnvValue(defaultProxySettings())).toBe('localhost,127.0.0.1,::1');
  });

  it('keeps suffix, wildcard, host:port and plain host rules untouched', () => {
    const settings = {
      ...defaultProxySettings(),
      bypassList: ['.corp.example', '*.internal', 'build.corp:8080', 'registry.npmjs.org'],
    };
    expect(noProxyEnvValue(settings)).toBe(
      '.corp.example,*.internal,build.corp:8080,registry.npmjs.org',
    );
  });

  it('dedupes across the expansion, so <local> plus an explicit localhost lists it once', () => {
    const settings = { ...defaultProxySettings(), bypassList: ['<local>', 'localhost', '::1'] };
    expect(noProxyEnvValue(settings)).toBe('localhost,127.0.0.1,::1');
  });

  it("is '' when nothing is bypassed", () => {
    expect(noProxyEnvValue({ ...defaultProxySettings(), bypassList: [] })).toBe('');
  });
});
