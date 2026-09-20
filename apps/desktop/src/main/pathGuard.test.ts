import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { tempDir } from '../test/main/fixtures';
import { assertPathWithinRoots } from './pathGuard';

/**
 * The guard walks up the path calling realpath until something resolves. On Windows an unmounted
 * drive letter makes even the root fail; on Linux the root always resolves, so that last step is
 * only reachable by making realpath refuse everything.
 */
const realpath = vi.hoisted(() => ({ refuseEverything: false }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    realpath: (...args: Parameters<typeof actual.realpath>) =>
      realpath.refuseEverything
        ? Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
        : actual.realpath(...args),
  };
});

/**
 * Every filesystem IPC handler funnels a renderer-supplied path through this guard, so a hole
 * here is a read or write anywhere on the machine. The cases below are the shapes that actually
 * reach it: a project folder, a file about to be created, and a repo that carries a symlink.
 */

/**
 * Links a folder and returns the link path. Windows needs developer mode or admin rights for a
 * real symlink, so this uses a junction there, which any user can create.
 */
function link(target: string, path: string): string {
  symlinkSync(target, path, process.platform === 'win32' ? 'junction' : 'dir');
  return path;
}

/** False on a machine that will not create one, so the symlink cases skip instead of failing. */
const canLink = ((): boolean => {
  try {
    link(tempDir(), join(tempDir(), 'probe'));
    return true;
  } catch {
    return false;
  }
})();

describe('assertPathWithinRoots', () => {
  it('accepts the root itself', async () => {
    const root = tempDir();
    await expect(assertPathWithinRoots(root, [root])).resolves.toBe(resolve(root));
  });

  it('accepts a nested file that exists', async () => {
    const root = tempDir();
    mkdirSync(join(root, 'src', 'deep'), { recursive: true });
    const file = join(root, 'src', 'deep', 'index.ts');
    writeFileSync(file, 'export {};\n', 'utf-8');
    await expect(assertPathWithinRoots(file, [root])).resolves.toBe(resolve(file));
  });

  it('accepts a file that does not exist yet under a folder that does', async () => {
    const root = tempDir();
    // The write handlers call the guard before creating the file, so this is the common case.
    const target = join(root, 'notes', 'new-file.md');
    await expect(assertPathWithinRoots(target, [root])).resolves.toBe(resolve(target));
  });

  it('rejects an escape through ..', async () => {
    const root = tempDir();
    mkdirSync(join(root, 'project'));
    await expect(
      assertPathWithinRoots(join(root, 'project', '..', '..', 'secrets.txt'), [
        join(root, 'project'),
      ]),
    ).rejects.toThrow(/outside of the allowed directories/);
  });

  it('rejects a sibling whose name starts with the root name', async () => {
    // The prefix trap: "root-evil" starts with "root", so a plain startsWith check would
    // let it through. Containment has to be on path segments.
    const parent = tempDir();
    const root = join(parent, 'root');
    const evil = join(parent, 'root-evil');
    mkdirSync(root);
    mkdirSync(evil);
    writeFileSync(join(evil, 'stolen.txt'), 'x', 'utf-8');
    await expect(assertPathWithinRoots(join(evil, 'stolen.txt'), [root])).rejects.toThrow(
      /outside of the allowed directories/,
    );
  });

  it('accepts a path under any one of several roots', async () => {
    const first = tempDir();
    const second = tempDir();
    const third = tempDir();
    const target = join(second, 'file.txt');
    writeFileSync(target, 'x', 'utf-8');
    await expect(assertPathWithinRoots(target, [first, second, third])).resolves.toBe(
      resolve(target),
    );
  });

  it('rejects everything when there are no roots', async () => {
    const root = tempDir();
    await expect(assertPathWithinRoots(root, [])).rejects.toThrow(
      /outside of the allowed directories/,
    );
  });

  it('names the path the caller passed in the error', async () => {
    const root = tempDir();
    const outside = join(tempDir(), 'elsewhere.txt');
    await expect(assertPathWithinRoots(outside, [root])).rejects.toThrow(outside);
  });

  it.skipIf(!canLink)('rejects a path that leaves the root through a symlink', async () => {
    const root = tempDir();
    const outside = tempDir();
    writeFileSync(join(outside, 'secret.txt'), 'top secret', 'utf-8');
    // A cloned repo can easily carry one of these, and it looks contained to resolve().
    link(outside, join(root, 'link'));

    await expect(assertPathWithinRoots(join(root, 'link', 'secret.txt'), [root])).rejects.toThrow(
      /outside of the allowed directories/,
    );
  });

  it.skipIf(!canLink)(
    'rejects a file that does not exist yet behind a symlinked parent',
    async () => {
      const root = tempDir();
      const outside = tempDir();
      link(outside, join(root, 'link'));

      // Nothing at the end of the path exists, so the guard has to resolve the nearest existing
      // ancestor instead of giving up and trusting the textual path.
      await expect(
        assertPathWithinRoots(join(root, 'link', 'planted.txt'), [root]),
      ).rejects.toThrow(/outside of the allowed directories/);
    },
  );

  it.skipIf(!canLink)('accepts a symlink that points back inside the root', async () => {
    const root = tempDir();
    mkdirSync(join(root, 'real'));
    writeFileSync(join(root, 'real', 'file.txt'), 'x', 'utf-8');
    link(join(root, 'real'), join(root, 'alias'));

    await expect(assertPathWithinRoots(join(root, 'alias', 'file.txt'), [root])).resolves.toBe(
      resolve(join(root, 'alias', 'file.txt')),
    );
  });

  it.skipIf(!canLink)(
    'follows a symlinked root, so a linked project folder still works',
    async () => {
      const real = tempDir();
      const holder = tempDir();
      writeFileSync(join(real, 'file.txt'), 'x', 'utf-8');
      const linkedRoot = link(real, join(holder, 'project'));

      // The root is the link, the candidate the real path: both sides get resolved, so they meet.
      await expect(assertPathWithinRoots(join(real, 'file.txt'), [linkedRoot])).resolves.toBe(
        resolve(join(real, 'file.txt')),
      );
    },
  );

  it('falls back to the textual path when no ancestor resolves at all', async () => {
    // What an unmounted drive letter looks like on Windows: realpath fails the whole way up to
    // the filesystem root, so containment is decided on the resolved strings. Nothing exists,
    // so nothing can be smuggled through a link either.
    const root = resolve(tempDir(), 'allowed');
    realpath.refuseEverything = true;
    try {
      await expect(assertPathWithinRoots(join(root, 'deep', 'file.txt'), [root])).resolves.toBe(
        resolve(join(root, 'deep', 'file.txt')),
      );
      await expect(
        assertPathWithinRoots(join(root, '..', 'other', 'file.txt'), [root]),
      ).rejects.toThrow(/outside of the allowed directories/);
    } finally {
      realpath.refuseEverything = false;
    }
  });
});
