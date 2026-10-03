import { spawn } from 'node:child_process';

/** How long a shell is given to have its tree taken down before it is killed regardless. */
export const TREE_KILL_TIMEOUT_MS = 3000;

/**
 * Ends a shell and everything it started. Killing just the shell leaves a dev server, Gradle or
 * Flutter it launched running on Windows, with nothing left to stop them from the app.
 *
 * On Windows taskkill /T has to run while the shell is still alive: it finds children by their
 * parent pid, and once the shell is gone they no longer lead back to it. So the shell itself is
 * only killed after taskkill finishes (or fails, or takes too long). taskkill runs detached so it
 * still completes when the pty host exits right after a shutdown.
 *
 * Elsewhere the shell leads its own process group; hanging that up reaches the foreground job.
 * `killPty` is called exactly once either way.
 */
export function killShellTree(
  pid: number,
  killPty: () => void,
  platform: NodeJS.Platform = process.platform,
): void {
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    try {
      killPty();
    } catch {
      // already gone
    }
  };
  const timer = setTimeout(finish, TREE_KILL_TIMEOUT_MS);
  timer.unref?.();

  if (!Number.isInteger(pid) || pid <= 0) {
    finish();
    return;
  }

  if (platform === 'win32') {
    try {
      const child = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.once('exit', finish);
      child.once('error', finish);
      child.unref();
    } catch {
      finish();
    }
    return;
  }

  try {
    process.kill(-pid, 'SIGHUP');
  } catch {
    // No such group, or it is already gone.
  }
  finish();
}
