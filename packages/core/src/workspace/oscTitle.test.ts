import { describe, expect, it } from 'vitest';
import { cleanTerminalTitle, OscTitleParser } from './oscTitle.js';

describe('OscTitleParser', () => {
  it('reads BEL and ST terminated titles', () => {
    const parser = new OscTitleParser();
    expect(parser.push('hello\x1b]0;first\x07world')).toBe('first');
    expect(parser.push('\x1b]2;second\x1b\\')).toBe('second');
  });

  it('returns the last title in a chunk and ignores other OSC codes', () => {
    const parser = new OscTitleParser();
    expect(parser.push('\x1b]0;a\x07\x1b]8;;http://x\x07\x1b]2;b\x07')).toBe('b');
    expect(parser.push('\x1b]7;file://host/dir\x07')).toBeNull();
  });

  it('joins sequences split across chunks', () => {
    const parser = new OscTitleParser();
    expect(parser.push('output\x1b')).toBeNull();
    expect(parser.push(']0;spl')).toBeNull();
    expect(parser.push('it\x07more')).toBe('split');
  });

  it('cleans spinner prefixes and control characters', () => {
    expect(cleanTerminalTitle('✳ Fix login bug')).toEqual({
      title: 'Fix login bug',
      spinning: true,
    });
    expect(cleanTerminalTitle('/home/me')).toEqual({ title: '/home/me', spinning: false });
  });
});
