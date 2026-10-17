import { describe, expect, it, vi } from 'vitest';
import { createDockerDesktopLauncher } from './managedRuntime';

/**
 * Starting Docker Desktop is the one launch the app does itself, so where it looks and what it
 * refuses to start are worth pinning. Nothing real is started: the spawn is a stand-in.
 */

function launcher(options: {
  os: 'win32' | 'darwin' | 'linux';
  env?: Record<string, string | undefined>;
  existing?: string[];
}) {
  const started: Array<{ file: string; args: string[] }> = [];
  const launch = createDockerDesktopLauncher({
    os: options.os,
    env: options.env ?? {},
    exists: (path) => (options.existing ?? []).includes(path),
    startDetached: vi.fn((file: string, args: string[]) => {
      started.push({ file, args });
    }),
  });
  return { launch, started };
}

describe('createDockerDesktopLauncher', () => {
  it('starts Docker Desktop from Program Files on Windows', async () => {
    const exe = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
    const { launch, started } = launcher({
      os: 'win32',
      env: { ProgramFiles: 'C:\\Program Files' },
      existing: [exe],
    });

    expect(await launch()).toEqual({ ok: true });
    expect(started).toEqual([{ file: exe, args: [] }]);
  });

  it('follows ProgramFiles when Windows is not on C:', async () => {
    const exe = 'D:\\Apps\\Docker\\Docker\\Docker Desktop.exe';
    const { launch, started } = launcher({
      os: 'win32',
      env: { ProgramFiles: 'D:\\Apps' },
      existing: [exe],
    });

    await launch();

    expect(started[0]?.file).toBe(exe);
  });

  it('says so when Docker Desktop is not installed, and starts nothing', async () => {
    const { launch, started } = launcher({
      os: 'win32',
      env: { ProgramFiles: 'C:\\Program Files' },
    });

    expect(await launch()).toEqual({
      ok: false,
      message: 'Docker Desktop was not found. Install it first.',
    });
    expect(started).toEqual([]);
  });

  it('opens the Docker app on a Mac', async () => {
    const { launch, started } = launcher({ os: 'darwin', existing: ['/Applications/Docker.app'] });

    expect(await launch()).toEqual({ ok: true });
    expect(started).toEqual([{ file: 'open', args: ['-a', 'Docker'] }]);
  });

  it('says so on a Mac without it', async () => {
    const { launch, started } = launcher({ os: 'darwin' });

    expect(await launch()).toMatchObject({ ok: false });
    expect(started).toEqual([]);
  });

  it('leaves starting the engine to the person on Linux, where it is a system service', async () => {
    const { launch, started } = launcher({ os: 'linux' });

    expect(await launch()).toEqual({
      ok: false,
      message: 'On Linux, start Docker with: sudo systemctl enable --now docker',
    });
    expect(started).toEqual([]);
  });
});
