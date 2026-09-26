import { create } from 'zustand';
import { extractLocalUrls, stripAnsi } from '@/lib/browser/devServers';

/**
 * Dev server addresses printed by the workspace's terminals (`Local: http://localhost:5173/`),
 * so a new browser tab can offer them. Fed from the terminal output stream, keyed by session.
 */

/** Enough of the previous chunk to catch an address split across two writes. */
const CARRY = 120;
const MAX_PER_TERMINAL = 6;

export interface DetectedServer {
  url: string;
  terminalId: string;
  terminalTitle: string;
}

interface DevServerState {
  /** Newest first, per terminal session. */
  servers: Record<string, string[]>;
  noteOutput: (sessionId: string, data: string) => void;
  forget: (sessionId: string) => void;
  reset: () => void;
}

const tails = new Map<string, string>();

export const useDevServerStore = create<DevServerState>()((set) => ({
  servers: {},

  noteOutput: (sessionId, data) => {
    // Cheap check first: most output has no address in it at all.
    const tail = tails.get(sessionId) ?? '';
    const text = tail + data;
    // Only the unfinished last line carries over; finished lines were scanned already.
    const plain = stripAnsi(text);
    tails.set(sessionId, plain.slice(plain.lastIndexOf('\n') + 1).slice(-CARRY));
    if (!/:\/\/|host|:\d/.test(text)) return;
    const found = extractLocalUrls(text);
    if (found.length === 0) return;
    set((state) => {
      const current = state.servers[sessionId] ?? [];
      const next = [...found.reverse(), ...current.filter((url) => !found.includes(url))].slice(
        0,
        MAX_PER_TERMINAL,
      );
      if (next.length === current.length && next.every((url, i) => url === current[i])) {
        return state;
      }
      return { servers: { ...state.servers, [sessionId]: next } };
    });
  },

  forget: (sessionId) => {
    tails.delete(sessionId);
    set((state) => {
      if (!state.servers[sessionId]) return state;
      const { [sessionId]: _gone, ...servers } = state.servers;
      return { servers };
    });
  },

  reset: () => {
    tails.clear();
    set({ servers: {} });
  },
}));

/** The servers the given terminals printed, each address once, newest per terminal first. */
export function detectedServersFor(
  servers: Record<string, string[]>,
  terminals: readonly { id: string; title: string }[],
): DetectedServer[] {
  const seen = new Set<string>();
  const out: DetectedServer[] = [];
  for (const terminal of terminals) {
    for (const url of servers[terminal.id] ?? []) {
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, terminalId: terminal.id, terminalTitle: terminal.title });
    }
  }
  return out;
}
