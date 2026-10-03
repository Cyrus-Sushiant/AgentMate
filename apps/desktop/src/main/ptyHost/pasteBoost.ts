import { execFile } from 'node:child_process';
import { constants, getPriority, setPriority } from 'node:os';
import type { IPty } from 'node-pty';

/**
 * Keeps a large paste moving when the machine is busy (Windows only).
 *
 * A program reading a ConPTY in raw mode (every Node or Bun CLI, Claude Code and Codex included)
 * pulls its input out of conhost one record at a time, two records per character, each one a
 * round trip between the program and conhost. At 100% CPU both wait a full scheduler slice for
 * every round trip, so a pasted page of text took minutes to arrive, or seemed never to. Raising
 * conhost and every process attached to that console to above-normal priority for the length of
 * the paste brings it back to its idle speed: in a 16-core burn test a 20 KB paste went from not
 * arriving in 60 seconds to under one second. Both sides have to be raised; either alone stays stuck.
 *
 * The raise is temporary. An agent CLI left above normal would starve the build that made the
 * machine busy in the first place.
 */

/** Smaller writes are keystrokes or short commands; they get through fine on their own. */
export const PASTE_BOOST_MIN_CHARS = 512;

const RAISED = constants.priority.PRIORITY_ABOVE_NORMAL;

/** How long a paste keeps its processes raised. Nothing reports when the program has read all
 * of it (a CLI holds a bracketed paste until the end marker and prints nothing meanwhile), so
 * this is a generous estimate: a 200 KB paste reads in about 7 seconds once raised. */
export function boostHoldMs(chars: number): number {
  return Math.min(120_000, 10_000 + Math.ceil(chars / 10_000) * 1_000);
}

export interface ProcessPriority {
  get(pid: number): number;
  set(pid: number, priority: number): void;
}

const osPriority: ProcessPriority = {
  get: (pid) => getPriority(pid),
  set: (pid, priority) => setPriority(pid, priority),
};

export interface PasteBoostOptions {
  priority?: ProcessPriority;
  /** The conhost processes behind this process's pseudoconsoles. */
  consoleHosts?: () => Promise<number[]>;
}

export interface PasteBoost {
  /** A large write just went to a session. `clients` lists the processes attached to its console. */
  boost(sessionId: string, clients: () => Promise<number[]>, chars: number): void;
  /** A pseudoconsole was created or closed, so the cached conhost list is stale. */
  consolesChanged(): void;
  /** Puts every raised process back where it was. */
  dispose(): void;
}

interface Raised {
  original: number;
  until: number;
}

export function createPasteBoost(options: PasteBoostOptions = {}): PasteBoost {
  const priority = options.priority ?? osPriority;
  const listHosts = options.consoleHosts ?? conhostChildren;
  const raised = new Map<number, Raised>();
  /** Sessions with a process lookup under way, and the longest hold asked for meanwhile. */
  const looking = new Map<string, number>();
  let hosts: Promise<number[]> | null = null;
  let timer: NodeJS.Timeout | null = null;

  function raise(pid: number, until: number): void {
    const known = raised.get(pid);
    if (known) {
      known.until = Math.max(known.until, until);
      return;
    }
    try {
      const original = priority.get(pid);
      // Already this high or higher (lower numbers are higher priority): leave it alone.
      if (original <= RAISED) return;
      priority.set(pid, RAISED);
      raised.set(pid, { original, until });
    } catch {
      // The process exited after it was listed.
    }
  }

  function restore(pid: number, entry: Raised): void {
    raised.delete(pid);
    try {
      // Only undo our own change. A different value means someone else set it since, or the pid
      // now belongs to another process.
      if (priority.get(pid) === RAISED) priority.set(pid, entry.original);
    } catch {
      // The process is gone, which restores it just as well.
    }
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    if (raised.size === 0) return;
    const next = Math.min(...[...raised.values()].map((entry) => entry.until));
    timer = setTimeout(expire, Math.max(0, next - Date.now()));
  }

  function expire(): void {
    timer = null;
    const now = Date.now();
    for (const [pid, entry] of [...raised]) if (entry.until <= now) restore(pid, entry);
    schedule();
  }

  return {
    boost(sessionId, clients, chars) {
      const hold = boostHoldMs(chars);
      const pending = looking.get(sessionId);
      if (pending !== undefined) {
        // A lookup for this session is already running and will apply the longest hold.
        looking.set(sessionId, Math.max(pending, hold));
        return;
      }
      looking.set(sessionId, hold);
      if (!hosts) {
        const lookup = listHosts()
          .catch(() => [])
          .then((pids) => {
            // Nothing found is most likely a failed lookup; try again on the next paste.
            if (pids.length === 0 && hosts === lookup) hosts = null;
            return pids;
          });
        hosts = lookup;
      }
      const lookups = [hosts, clients().catch(() => [])];
      // Each list is applied as soon as it arrives. Raising one side early already helps, and the
      // conhost lookup is the slow one under load.
      let left = lookups.length;
      for (const lookup of lookups) {
        void lookup.then((pids) => {
          const until = Date.now() + (looking.get(sessionId) ?? hold);
          for (const pid of pids) raise(pid, until);
          left -= 1;
          if (left === 0) looking.delete(sessionId);
          schedule();
        });
      }
    },
    consolesChanged() {
      hosts = null;
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      for (const [pid, entry] of [...raised]) restore(pid, entry);
      looking.clear();
    },
  };
}

/**
 * Every process attached to a session's console: the shell and whatever it started. node-pty
 * keeps the lookup it uses for `kill` private, so fall back to the shell alone without it.
 */
export function consoleClients(ptyProcess: IPty): Promise<number[]> {
  const agent = (
    ptyProcess as unknown as { _agent?: { _getConsoleProcessList?: () => Promise<number[]> } }
  )._agent;
  if (typeof agent?._getConsoleProcessList === 'function') return agent._getConsoleProcessList();
  return Promise.resolve([ptyProcess.pid]);
}

/** The conhost (or bundled OpenConsole) processes this process started for its pseudoconsoles. */
function conhostChildren(): Promise<number[]> {
  const query =
    `Get-CimInstance Win32_Process -Filter "ParentProcessId=${process.pid} and ` +
    `(Name='conhost.exe' or Name='OpenConsole.exe')" | ForEach-Object { $_.ProcessId }`;
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', query],
      { windowsHide: true, timeout: 20_000 },
      (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }
        resolve(
          stdout
            .split(/\s+/)
            .map(Number)
            .filter((pid) => Number.isInteger(pid) && pid > 0),
        );
      },
    );
  });
}
