import * as pty from 'node-pty';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PtySessionManager } from './sessionManager';
import { ensureSpawnHelper } from './spawnHelper';

/**
 * A macOS install whose spawn-helper lost its execute bit must fail fast naming the helper,
 * instead of reaching the pty and failing with the cryptic "posix_spawnp failed". Both
 * boundaries are mocked here; the real spawn path is covered by sessionManager.test.ts.
 */

vi.mock('node-pty', () => ({ spawn: vi.fn() }));
vi.mock('./spawnHelper', () => ({ ensureSpawnHelper: vi.fn() }));

const spawnMock = pty.spawn as unknown as Mock;
const ensureMock = ensureSpawnHelper as unknown as Mock;

function fakePty(): unknown {
  return {
    pid: 4242,
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };
}

let manager: PtySessionManager;

beforeEach(() => {
  spawnMock.mockReset().mockReturnValue(fakePty());
  ensureMock.mockReset().mockReturnValue({ ok: true, path: '/pty/spawn-helper', detail: '' });
  manager = new PtySessionManager(
    () => undefined,
    () => undefined,
    // The real boost only exists on Windows; null keeps this hermetic everywhere.
    null,
  );
});

afterEach(() => {
  manager.killAll();
});

describe('spawn-helper gate', () => {
  it('fails fast with the helper path when the bit cannot be restored', async () => {
    ensureMock.mockReturnValue({
      ok: false,
      path: '/pty/spawn-helper',
      detail:
        'node-pty spawn-helper at /pty/spawn-helper is not executable and could not be ' +
        'repaired (EACCES); terminals cannot start until it is executable',
    });

    await expect(
      manager.createOrAttach(
        { sessionId: 's1', shell: 'zsh', cwd: '/tmp' },
        { onData: () => undefined, onExit: () => undefined },
      ),
    ).rejects.toThrow(/spawn-helper at \/pty\/spawn-helper is not executable/);

    // Never reached the pty, and nothing is tracked as running.
    expect(spawnMock).not.toHaveBeenCalled();
    expect(manager.size).toBe(0);
  });

  it('spawns once the helper is healthy', async () => {
    const result = await manager.createOrAttach(
      { sessionId: 's1', shell: 'bash', cwd: '/tmp' },
      { onData: () => undefined, onExit: () => undefined },
    );

    expect(result).toEqual({ isNew: true, snapshot: null });
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(manager.size).toBe(1);
  });
});
