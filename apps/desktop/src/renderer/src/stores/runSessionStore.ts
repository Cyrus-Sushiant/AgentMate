import { parseRunDevices, parseScopeId } from '@agentmat/core';
import { toast } from 'sonner';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { extractLocalUrls, stripAnsi } from '@/lib/browser/devServers';
import {
  type TerminalRunInfo,
  type TerminalSessionMeta,
  useTerminalStore,
} from '@/stores/terminalStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * What each project run's terminal has printed that says where to reach it: local addresses
 * (`http://localhost:5173/`) and the emulator or phone a mobile app went to. Persisted, so a
 * run that is still going after a restart keeps its device; the port also comes back from the
 * listening-port scan.
 */

/** Enough of the previous chunk to catch an address or device line split across two writes. */
const CARRY = 160;
const MAX_URLS = 6;
const MAX_DEVICES = 4;

export interface RunOutput {
  /** In the order they were printed. */
  urls: string[];
  /** In the order they were printed; the last one is the latest. */
  devices: string[];
}

interface RunSessionState {
  outputs: Record<string, RunOutput>;
  noteOutput: (sessionId: string, data: string) => void;
  /** Drops what is kept for sessions that are no longer runs in the drawer. */
  prune: (liveIds: readonly string[]) => void;
}

const tails = new Map<string, string>();

function merged(current: string[], found: string[], max: number): string[] {
  const next = [...current.filter((item) => !found.includes(item)), ...found];
  return next.slice(-max);
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

export const useRunSessionStore = create<RunSessionState>()(
  persist(
    (set) => ({
      outputs: {},

      noteOutput: (sessionId, data) => {
        const plain = stripAnsi((tails.get(sessionId) ?? '') + data);
        // Only the unfinished last line carries over; finished lines were scanned already.
        tails.set(sessionId, plain.slice(plain.lastIndexOf('\n') + 1).slice(-CARRY));
        // Cheap check first: most output names neither an address nor a device.
        if (!/:\/\/|emulator-|Launching|Installing|Opening/.test(plain)) return;
        const urls = extractLocalUrls(plain);
        const devices = parseRunDevices(plain);
        if (urls.length === 0 && devices.length === 0) return;
        set((state) => {
          const current = state.outputs[sessionId] ?? { urls: [], devices: [] };
          // An address printed again keeps its first place: Vite lists Local before Network.
          const nextUrls = [
            ...current.urls,
            ...urls.filter((url) => !current.urls.includes(url)),
          ].slice(0, MAX_URLS);
          const nextDevices = merged(current.devices, devices, MAX_DEVICES);
          if (sameList(nextUrls, current.urls) && sameList(nextDevices, current.devices)) {
            return state;
          }
          return {
            outputs: { ...state.outputs, [sessionId]: { urls: nextUrls, devices: nextDevices } },
          };
        });
      },

      prune: (liveIds) => {
        const live = new Set(liveIds);
        for (const id of tails.keys()) if (!live.has(id)) tails.delete(id);
        set((state) => {
          const kept = Object.entries(state.outputs).filter(([id]) => live.has(id));
          if (kept.length === Object.keys(state.outputs).length) return state;
          return { outputs: Object.fromEntries(kept) };
        });
      },
    }),
    {
      name: 'agentmate-run-sessions',
      partialize: (state) => ({ outputs: state.outputs }),
    },
  ),
);

export type RunSessionMeta = TerminalSessionMeta & { run: TerminalRunInfo };

/** The drawer tabs that run a project's run command, oldest first. */
export function runSessionsOf(sessions: readonly TerminalSessionMeta[]): RunSessionMeta[] {
  return sessions.filter(
    (session): session is RunSessionMeta => session.run !== undefined && session.kind !== 'ssh',
  );
}

/** Closes a run's tab, which ends its shell and everything the shell started. */
export function stopRun(sessionId: string): void {
  const session = useTerminalStore.getState().sessions.find((s) => s.id === sessionId);
  if (!session) return;
  useTerminalStore.getState().closeSession(sessionId);
  if (session.run) toast.success(`Stopped "${session.run.label}"`);
}

/**
 * Which run the stop shortcut ends: the run open in the drawer, or else the newest run of the
 * workspace's project, or else the newest run. Plain shells and agent tabs are never picked.
 */
export function pickRunToStop(
  terminal: Pick<
    ReturnType<typeof useTerminalStore.getState>,
    'sessions' | 'activeSessionId' | 'isOpen'
  >,
  workspaceScopeId: string | null,
): string | null {
  const runs = runSessionsOf(terminal.sessions);
  if (runs.length === 0) return null;
  if (terminal.isOpen) {
    const active = runs.find((run) => run.id === terminal.activeSessionId);
    if (active) return active.id;
  }
  if (workspaceScopeId) {
    const projectId = parseScopeId(workspaceScopeId).projectId;
    const ofProject = runs.filter(
      (run) => run.projectId === workspaceScopeId || run.projectId === projectId,
    );
    const newest = ofProject.at(-1);
    if (newest) return newest.id;
  }
  return runs.at(-1)?.id ?? null;
}

/** The stop shortcut's action. */
export function stopActiveRun(): void {
  const id = pickRunToStop(
    useTerminalStore.getState(),
    useWorkspaceStore.getState().activeProjectId,
  );
  if (id) stopRun(id);
  else toast.info('Nothing is running');
}
