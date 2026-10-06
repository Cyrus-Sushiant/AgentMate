import { describe, expect, it } from 'vitest';
import {
  createWpIgnoreRules,
  findWpCaseCollisions,
  isWpHardDenied,
  wpItemKey,
  wpItemRoot,
  wpMirrorPath,
} from './pathPolicy.js';

describe('the hard deny list', () => {
  it('matches any segment, in any case', () => {
    expect(isWpHardDenied('inc/.Claude/x.md')).toBe(true);
    expect(isWpHardDenied('a/b/Gemini.MD')).toBe(true);
    expect(isWpHardDenied('certs/site.PEM')).toBe(true);
    expect(isWpHardDenied('inc/environment.php')).toBe(false);
    // Lookalikes a case-insensitive disk may fold into a denied name (the long s).
    expect(isWpHardDenied('.curſor/rules/r.mdc')).toBe(true);
    expect(isWpHardDenied('AGENTſ.md')).toBe(true);
    expect(isWpHardDenied('claude.php')).toBe(false);
  });
});

describe('mirror paths', () => {
  it('keep the site layout inside the project folder', () => {
    expect(wpItemRoot({ kind: 'mu-plugin', slug: 'loader.php' })).toBe(
      'wp-content/mu-plugins/loader.php',
    );
    expect(wpMirrorPath({ kind: 'theme', slug: 't' }, false, 'inc/a.php')).toBe(
      'wp-content/themes/t/inc/a.php',
    );
    expect(wpMirrorPath({ kind: 'plugin', slug: 'hello.php' }, true, 'hello.php')).toBe(
      'wp-content/plugins/hello.php',
    );
    expect(() => wpMirrorPath({ kind: 'plugin', slug: 'hello.php' }, true, 'other.php')).toThrow();
    expect(wpItemKey({ kind: 'plugin', slug: 'akismet' })).toBe('plugin:akismet');
  });
});

describe('case collisions', () => {
  it('find paths that are one file on Windows or macOS', () => {
    expect(findWpCaseCollisions(['a.php', 'A.php', 'b.php', 'x/Y', 'X/y'])).toEqual([
      ['a.php', 'A.php'],
      ['x/Y', 'X/y'],
    ]);
  });
});

describe('ignore rules', () => {
  it('leave local clutter out until the site has it, at any depth', () => {
    const built = createWpIgnoreRules([]);
    if (!built.ok) throw new Error('should compile');
    const { rules } = built;
    expect(rules.excludedUnlessTracked('assets/debug.log')).toBe(true);
    expect(rules.excludedUnlessTracked('skills/x.md')).toBe(true);
    expect(rules.excludedUnlessTracked('inc/skills/x.md')).toBe(false);
    expect(rules.excluded('assets/debug.log')).toBe(false);
    expect(rules.canSkipFolder('node_modules')).toBe(true);
    expect(rules.canSkipFolder('inc')).toBe(false);
  });

  it("apply the user's own files both ways, and let them put defaults back", () => {
    const built = createWpIgnoreRules([
      { source: '.distignore', text: '# dev only\n/tests/\nphpunit.xml\r\n\n' },
      { source: '.agentmateignore', text: '!.editorconfig\n!/skills/\n' },
    ]);
    if (!built.ok) throw new Error('should compile');
    const { rules } = built;
    expect(rules.excluded('tests/a.php')).toBe(true);
    expect(rules.excluded('inc/tests/a.php')).toBe(false);
    expect(rules.excluded('sub/phpunit.xml')).toBe(true);
    expect(rules.excludedUnlessTracked('.editorconfig')).toBe(false);
    expect(rules.excludedUnlessTracked('skills/x.md')).toBe(false);
    // `!.editorconfig` could put back node_modules/.editorconfig, so the walker has to look.
    expect(rules.canSkipFolder('node_modules')).toBe(false);
    expect(rules.canSkipFolder('skills')).toBe(false);
  });

  it('let a layer from the site only leave more out, never put things back', () => {
    const built = createWpIgnoreRules([
      {
        source: '.distignore',
        text: '!.editorconfig\n!node_modules/\n/tests/\n',
        negations: false,
      },
    ]);
    if (!built.ok) throw new Error('should compile');
    expect(built.rules.excludedUnlessTracked('.editorconfig')).toBe(true);
    expect(built.rules.excludedUnlessTracked('node_modules/x.js')).toBe(true);
    expect(built.rules.excluded('tests/a.php')).toBe(true);
  });

  it('say which file and line is wrong', () => {
    expect(createWpIgnoreRules([{ source: '.agentmateignore', text: 'ok\n[a' }])).toEqual({
      ok: false,
      source: '.agentmateignore',
      line: 2,
      reason: expect.stringContaining('never closed'),
    });
  });

  it('skip lines that are only a slash or a bang', () => {
    const built = createWpIgnoreRules([{ source: '.distignore', text: '/\n!\n' }]);
    expect(built.ok).toBe(true);
  });
});
