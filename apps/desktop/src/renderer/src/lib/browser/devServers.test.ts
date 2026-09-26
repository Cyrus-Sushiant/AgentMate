import { describe, expect, it } from 'vitest';
import { extractLocalUrls } from './devServers';

describe('extractLocalUrls', () => {
  it('reads the Vite banner, ignoring the colors and the network address', () => {
    const banner =
      '\x1b[32m\x1b[1mVITE\x1b[22m v6.0.0\x1b[39m  \x1b[2mready in \x1b[0m\x1b[1m312\x1b[22m\x1b[2m ms\x1b[22m\r\n\r\n' +
      '  \x1b[32m➜\x1b[39m  \x1b[1mLocal\x1b[22m:   \x1b[36mhttp://localhost:\x1b[1m5173\x1b[22m/\x1b[39m\r\n' +
      '  \x1b[32m➜\x1b[39m  \x1b[1mNetwork\x1b[22m: \x1b[36mhttp://192.168.1.20:\x1b[1m5173\x1b[22m/\x1b[39m\r\n';
    expect(extractLocalUrls(banner)).toEqual(['http://localhost:5173/']);
  });

  it('reads the Next.js banner', () => {
    expect(
      extractLocalUrls('   ▲ Next.js 15.1.0\n   - Local:        http://localhost:3000\n'),
    ).toEqual(['http://localhost:3000/']);
  });

  it('reads the Storybook box, stopping at its border', () => {
    expect(extractLocalUrls('│   Local:            http://localhost:6006/   │\n')).toEqual([
      'http://localhost:6006/',
    ]);
  });

  it('turns 0.0.0.0 into localhost and keeps a path', () => {
    expect(extractLocalUrls('Listening on http://0.0.0.0:8000/docs.')).toEqual([
      'http://localhost:8000/docs',
    ]);
  });

  it('knows 127.0.0.1, [::1] and *.localhost', () => {
    expect(
      extractLocalUrls(
        'a http://127.0.0.1:8080 b https://[::1]:4443/ c http://shop.localhost:3000/cart',
      ),
    ).toEqual(['http://127.0.0.1:8080/', 'https://[::1]:4443/', 'http://shop.localhost:3000/cart']);
  });

  it('reads the visible text of an OSC 8 hyperlink once', () => {
    const link = '\x1b]8;;http://localhost:4321/\x07http://localhost:4321/\x1b]8;;\x07';
    expect(extractLocalUrls(`astro dev ${link}`)).toEqual(['http://localhost:4321/']);
  });

  it('lists each address once', () => {
    expect(extractLocalUrls('http://localhost:3000 then http://localhost:3000/ again')).toEqual([
      'http://localhost:3000/',
    ]);
  });

  it('ignores remote sites, ports out of range and addresses without a port', () => {
    expect(
      extractLocalUrls('https://example.com:3000 http://localhost http://localhost:99999'),
    ).toEqual([]);
  });
});
