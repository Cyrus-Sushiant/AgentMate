import { describe, expect, it } from 'vitest';
import { consoleText, isTextMime, mediaType, phaseTimings } from './responseShape';

describe('mediaType', () => {
  it('drops parameters and lower-cases', () => {
    expect(mediaType('Application/JSON; charset=utf-8')).toBe('application/json');
    expect(mediaType(undefined)).toBe('');
  });
});

describe('isTextMime', () => {
  it.each([
    'text/plain',
    'text/html',
    'application/json',
    'application/problem+json',
    'application/xml',
    'image/svg+xml',
    'application/javascript',
    'application/x-www-form-urlencoded',
    'application/graphql',
    'application/x-yaml',
  ])('treats %s as text', (mime) => {
    expect(isTextMime(mime, Buffer.from('{}'))).toBe(true);
  });

  it.each(['image/png', 'application/pdf', 'application/octet-stream', 'font/woff2'])(
    'treats %s as binary',
    (mime) => {
      expect(isTextMime(mime, Buffer.from('abc'))).toBe(false);
    },
  );

  it('sniffs a body with no content type', () => {
    expect(isTextMime('', Buffer.from('hello world'))).toBe(true);
    expect(isTextMime('', Buffer.from([0x00, 0x01, 0xff]))).toBe(false);
  });
});

describe('phaseTimings', () => {
  it('splits Postman offsets into phases', () => {
    expect(
      phaseTimings({
        request: 1,
        socket: 2,
        lookup: 7,
        connect: 12,
        secureConnect: 30,
        response: 80,
        end: 95,
        done: 96,
      }),
    ).toEqual({ dns: 5, tcp: 5, tls: 18, firstByte: 50, download: 15, total: 95 });
  });

  it('gives 0 for phases a reused socket skipped', () => {
    expect(phaseTimings({ request: 0, socket: 1, response: 20, end: 25 })).toEqual({
      dns: 0,
      tcp: 0,
      tls: 0,
      firstByte: 19,
      download: 5,
      total: 25,
    });
  });

  it('falls back to the total the response reported', () => {
    expect(phaseTimings(undefined, 42)).toEqual({
      dns: 0,
      tcp: 0,
      tls: 0,
      firstByte: 0,
      download: 0,
      total: 42,
    });
  });
});

describe('consoleText', () => {
  it('prints strings as they are and everything else as JSON', () => {
    expect(consoleText(['a', 1, true, null, { b: 2 }, undefined])).toEqual([
      'a',
      '1',
      'true',
      'null',
      '{"b":2}',
      'undefined',
    ]);
  });

  it('copes with values JSON cannot print', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(consoleText([loop])).toEqual(['[object Object]']);
  });
});
