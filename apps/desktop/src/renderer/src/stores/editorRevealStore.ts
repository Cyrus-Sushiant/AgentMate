import { create } from 'zustand';

/**
 * Where a file tab should put its cursor once it has loaded, for opening a search result at
 * its line. The editor takes a request as it applies it, so a later render or a restart never
 * jumps there again, which is also why none of this is saved.
 */

export interface RevealTarget {
  /** 1-based. */
  line: number;
  /** 1-based, in characters. */
  column: number;
  /** How many characters to select from there. */
  length?: number;
}

export interface Reveal extends RevealTarget {
  /** Tells two requests for the same place apart. */
  nonce: number;
}

interface EditorRevealState {
  pending: Record<string, Reveal>;
  requestReveal: (path: string, target: RevealTarget) => void;
  takeReveal: (path: string) => Reveal | null;
}

let nonce = 0;

export const useEditorRevealStore = create<EditorRevealState>((set, get) => ({
  pending: {},

  requestReveal: (path, target) => {
    nonce += 1;
    set((state) => ({ pending: { ...state.pending, [path]: { ...target, nonce } } }));
  },

  takeReveal: (path) => {
    const reveal = get().pending[path];
    if (!reveal) return null;
    set((state) => {
      const { [path]: _taken, ...rest } = state.pending;
      return { pending: rest };
    });
    return reveal;
  },
}));
