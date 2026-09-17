import { describe, expect, it } from 'vitest';
import { globToRegExp, matchesGlob } from './glob.js';

describe('globToRegExp', () => {
  it('matches a double star across folders, including none', () => {
    expect(matchesGlob('src/a.test.ts', '**/*.test.ts')).toBe(true);
    expect(matchesGlob('a.test.ts', '**/*.test.ts')).toBe(true);
    expect(matchesGlob('src/deep/er/a.test.ts', 'src/**/*.test.ts')).toBe(true);
    expect(matchesGlob('lib/a.test.ts', 'src/**/*.test.ts')).toBe(false);
  });

  it('keeps a single star inside one folder', () => {
    expect(matchesGlob('src/a.ts', 'src/*.ts')).toBe(true);
    expect(matchesGlob('src/x/a.ts', 'src/*.ts')).toBe(false);
  });

  it('expands braces and extglob groups', () => {
    expect(matchesGlob('a.spec.tsx', '**/*.{test,spec}.{ts,tsx}')).toBe(true);
    expect(matchesGlob('a.test.mjs', '**/*.@(spec|test).?(c|m)[jt]s?(x)')).toBe(true);
    expect(matchesGlob('a.test.js', '**/*.@(spec|test).?(c|m)[jt]s?(x)')).toBe(true);
    expect(matchesGlob('a.test.jsx', '**/*.@(spec|test).?(c|m)[jt]s?(x)')).toBe(true);
    expect(matchesGlob('a.check.js', '**/*.@(spec|test).?(c|m)[jt]s?(x)')).toBe(false);
  });

  it('treats dots and other regex characters literally', () => {
    expect(matchesGlob('axtest', '*.test')).toBe(false);
    expect(matchesGlob('a+b.test', '*.test')).toBe(true);
    expect(globToRegExp('a(b).ts').test('a(b).ts')).toBe(true);
  });

  it('matches a leading ./ the same as without it', () => {
    expect(matchesGlob('e2e/a.e2e.ts', './e2e/**/*.e2e.ts')).toBe(true);
  });
});
