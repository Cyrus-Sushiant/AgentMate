import { describe, expect, it } from 'vitest';
import { describeIdleAlert, formatIdleDuration } from './format.js';
import type { ActivityResource } from './types.js';

function resource(name: string, kind: ActivityResource['kind'] = 'docker'): ActivityResource {
  return {
    key: `${kind}:${name}`,
    kind,
    id: name,
    name,
    detail: null,
    cpuPercent: 0,
    memBytes: 0,
    measurable: true,
    firstSeenAt: 0,
    lastActiveAt: 0,
    idleForMs: 0,
    idle: true,
  };
}

describe('formatIdleDuration', () => {
  it('reads minutes, then hours, rounding down', () => {
    expect(formatIdleDuration(0)).toBe('under 1 min');
    expect(formatIdleDuration(59_999)).toBe('under 1 min');
    expect(formatIdleDuration(60_000)).toBe('1 min');
    expect(formatIdleDuration(23 * 60_000 + 59_000)).toBe('23 min');
    expect(formatIdleDuration(60 * 60_000)).toBe('1 h');
    expect(formatIdleDuration(65 * 60_000)).toBe('1 h 5 min');
    expect(formatIdleDuration(-5)).toBe('under 1 min');
  });
});

describe('describeIdleAlert', () => {
  it('words a single container in the singular', () => {
    expect(describeIdleAlert([resource('postgres')], 20)).toEqual({
      title: '1 idle container',
      body: 'postgres has been idle for 20 min. Open the Dashboard to stop it.',
    });
  });

  it('lists up to three names, then counts the rest', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((name) => resource(name));
    expect(describeIdleAlert(many, 30).body).toBe(
      'a, b, c and 2 more have been idle for 30 min. Open the Dashboard to stop them.',
    );
  });

  it('joins two or three names with and', () => {
    expect(describeIdleAlert([resource('db'), resource('redis')], 20).body).toContain(
      'db and redis have been',
    );
    expect(
      describeIdleAlert([resource('db'), resource('redis'), resource('web')], 20).body,
    ).toContain('db, redis and web have been');
  });

  it('names the kind in the title, including a mix', () => {
    expect(describeIdleAlert([resource('Pixel_7', 'emulator')], 20).title).toBe('1 idle emulator');
    expect(describeIdleAlert([resource('a'), resource('b', 'emulator')], 20).title).toBe(
      '2 idle containers and emulators',
    );
  });

  it('writes long thresholds in hours', () => {
    expect(describeIdleAlert([resource('a')], 90).body).toContain('1 h 30 min');
  });
});
