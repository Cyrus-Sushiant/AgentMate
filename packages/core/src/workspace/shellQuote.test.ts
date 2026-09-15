import { describe, expect, it } from 'vitest';
import { quoteAllForShell, quoteForShell, shellKindFor } from './shellQuote.js';

describe('shellQuote', () => {
  it('maps shells to quoting families', () => {
    expect(shellKindFor('powershell.exe', 'win32')).toBe('powershell');
    expect(shellKindFor('C:\\Windows\\System32\\cmd.exe', 'win32')).toBe('cmd');
    expect(shellKindFor('/usr/bin/fish', 'darwin')).toBe('fish');
    expect(shellKindFor('zsh', 'darwin')).toBe('posix');
    expect(shellKindFor(undefined, 'win32')).toBe('powershell');
    expect(shellKindFor(undefined, 'linux')).toBe('posix');
  });

  it('leaves safe words alone', () => {
    expect(quoteForShell('--settings', 'posix')).toBe('--settings');
    expect(quoteForShell('C:\\tools\\a.json', 'powershell')).toBe('C:\\tools\\a.json');
  });

  it('quotes spaces and quotes per shell', () => {
    const path = "C:\\My Files\\it's.txt";
    expect(quoteForShell(path, 'powershell')).toBe("'C:\\My Files\\it''s.txt'");
    expect(quoteForShell('a "b" c', 'cmd')).toBe('"a ""b"" c"');
    expect(quoteForShell("/tmp/it's here", 'posix')).toBe("'/tmp/it'\\''s here'");
    expect(quoteForShell("a\\b 'c'", 'fish')).toBe("'a\\\\b \\'c\\''");
  });

  it('quotes backslashes on POSIX shells', () => {
    expect(quoteForShell('a\\b', 'posix')).toBe("'a\\b'");
  });

  it('joins multiple values', () => {
    expect(quoteAllForShell(['a', 'b c'], 'posix')).toBe("a 'b c'");
  });
});
