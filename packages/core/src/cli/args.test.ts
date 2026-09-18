import { describe, expect, it } from 'vitest';
import {
  type CliArgsMap,
  getCliArgsFor,
  getCliArgvFor,
  normalizeCliArgs,
  parseCliArgs,
} from './args.js';

/**
 * These arguments end up as argv for every agent CLI the app spawns, so a mis-split
 * here silently changes the model or the profile a run uses. The cases below are the
 * contract: shell-like splitting, but with backslashes left literal for Windows paths.
 */

describe('parseCliArgs', () => {
  it('returns nothing for empty and absent input', () => {
    expect(parseCliArgs('')).toEqual([]);
    expect(parseCliArgs(undefined)).toEqual([]);
    expect(parseCliArgs(null)).toEqual([]);
    expect(parseCliArgs('   \t \n ')).toEqual([]);
  });

  it('splits on runs of whitespace of any kind', () => {
    expect(parseCliArgs('--model sonnet')).toEqual(['--model', 'sonnet']);
    expect(parseCliArgs('  --model    sonnet  ')).toEqual(['--model', 'sonnet']);
    expect(parseCliArgs('--a\t--b\n--c')).toEqual(['--a', '--b', '--c']);
  });

  it('groups a quoted run into one argument, in either quote style', () => {
    expect(parseCliArgs('--system "be terse and kind"')).toEqual(['--system', 'be terse and kind']);
    expect(parseCliArgs("--system 'be terse and kind'")).toEqual(['--system', 'be terse and kind']);
  });

  it('treats the other quote character as ordinary text inside a quoted run', () => {
    expect(parseCliArgs(`--msg "it's fine"`)).toEqual(['--msg', "it's fine"]);
    expect(parseCliArgs(`--msg 'say "hi"'`)).toEqual(['--msg', 'say "hi"']);
  });

  it('joins quoted and unquoted pieces that touch, the way a shell does', () => {
    expect(parseCliArgs('--flag="two words"')).toEqual(['--flag=two words']);
    expect(parseCliArgs('pre"mid"post')).toEqual(['premidpost']);
  });

  it('keeps an empty quoted string as a real argument', () => {
    // A CLI that takes `--suffix ""` to mean "no suffix" needs the empty entry to survive.
    expect(parseCliArgs('--suffix ""')).toEqual(['--suffix', '']);
    expect(parseCliArgs("--suffix ''")).toEqual(['--suffix', '']);
  });

  it('leaves backslashes literal so a Windows path survives', () => {
    // There is no escape character on purpose: C:\work\repo must not become C:workrepo.
    expect(parseCliArgs(String.raw`--cwd C:\work\repo`)).toEqual([
      '--cwd',
      String.raw`C:\work\repo`,
    ]);
    expect(parseCliArgs(String.raw`--cwd "C:\Program Files\repo"`)).toEqual([
      '--cwd',
      String.raw`C:\Program Files\repo`,
    ]);
  });

  it('closes an unterminated quote at the end of the line', () => {
    // A half-typed field should still produce something runnable rather than nothing.
    expect(parseCliArgs('--system "unfinished')).toEqual(['--system', 'unfinished']);
  });

  it('round trips argument lines that need no quoting', () => {
    for (const line of ['--model sonnet', '-m provider/model', '--yolo', '--a --b --c']) {
      expect(parseCliArgs(line).join(' ')).toBe(line);
    }
  });
});

describe('getCliArgsFor', () => {
  const map: CliArgsMap = { 'claude-code': '  --model sonnet  ', 'gemini-cli': '' };

  it('trims the stored line', () => {
    expect(getCliArgsFor(map, 'claude-code')).toBe('--model sonnet');
  });

  it("returns '' for an unset CLI and for an absent map", () => {
    expect(getCliArgsFor(map, 'gemini-cli')).toBe('');
    expect(getCliArgsFor(map, 'not-registered')).toBe('');
    expect(getCliArgsFor(undefined, 'claude-code')).toBe('');
  });
});

describe('getCliArgvFor', () => {
  it('splits the stored line', () => {
    expect(getCliArgvFor({ 'claude-code': '--model sonnet' }, 'claude-code')).toEqual([
      '--model',
      'sonnet',
    ]);
  });

  it('is empty when nothing is configured', () => {
    expect(getCliArgvFor(undefined, 'claude-code')).toEqual([]);
    expect(getCliArgvFor({}, 'claude-code')).toEqual([]);
  });
});

describe('normalizeCliArgs', () => {
  it('rejects anything that is not a plain object', () => {
    expect(normalizeCliArgs(null)).toEqual({});
    expect(normalizeCliArgs(undefined)).toEqual({});
    expect(normalizeCliArgs('--model sonnet')).toEqual({});
    expect(normalizeCliArgs(42)).toEqual({});
    // An array is an object, so it needs its own guard or it would come back as {'0': ...}.
    expect(normalizeCliArgs(['--model', 'sonnet'])).toEqual({});
  });

  it('drops non-string and blank entries, and trims the rest', () => {
    expect(
      normalizeCliArgs({
        'claude-code': '  --model sonnet ',
        'gemini-cli': '   ',
        opencode: '',
        'codex-cli': 42,
        'cursor-cli': null,
      }),
    ).toEqual({ 'claude-code': '--model sonnet' });
  });

  it('is idempotent, since settings.json is normalized on every read', () => {
    const once = normalizeCliArgs({ 'claude-code': ' --model sonnet ' });
    expect(normalizeCliArgs(once)).toEqual(once);
  });
});
