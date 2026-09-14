import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const TERMINAL_MIN_HEIGHT = 160;
export const TERMINAL_DEFAULT_HEIGHT = 288;

export interface TerminalSessionMeta {
  id: string;
  title: string;
  cwd?: string;
  shell?: string;
  initialInput?: string;
  projectId?: string;
  /**
   * Brought back from a previous run of the app. Its pane only reconnects to the shell that
   * is still running in the background and closes itself if that shell is gone, so a
   * restored tab never starts a new shell or replays its install command.
   */
  restored?: boolean;
}

interface TerminalState {
  isOpen: boolean;
  drawerHeight: number;
  sessions: TerminalSessionMeta[];
  activeSessionId: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setDrawerHeight: (height: number) => void;
  openSession: (meta: Omit<TerminalSessionMeta, 'id'> & { id?: string }) => string;
  openDefaultSession: () => string;
  /** Closes the tab and ends its shell. */
  closeSession: (id: string) => void;
  /** Drops the tab of a shell that has already ended. */
  forgetSession: (id: string) => void;
  setActiveSession: (id: string) => void;
}

type PersistedTerminalState = Pick<
  TerminalState,
  'isOpen' | 'drawerHeight' | 'sessions' | 'activeSessionId'
>;

/** The shell a plain "new tab" starts, per platform. */
export function defaultNewSession(): { title: string; shell?: string } {
  const platform = window.agentmat.platform;
  if (platform === 'win32') return { title: 'PowerShell', shell: 'powershell.exe' };
  if (platform === 'darwin') return { title: 'zsh', shell: 'zsh' };
  return { title: 'bash', shell: 'bash' };
}

function withoutSession(
  state: TerminalState,
  id: string,
): Pick<TerminalState, 'sessions' | 'activeSessionId'> {
  const remaining = state.sessions.filter((s) => s.id !== id);
  return {
    sessions: remaining,
    activeSessionId:
      state.activeSessionId === id ? (remaining.at(-1)?.id ?? null) : state.activeSessionId,
  };
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      drawerHeight: TERMINAL_DEFAULT_HEIGHT,
      sessions: [],
      activeSessionId: null,
      openDrawer: () => set({ isOpen: true }),
      closeDrawer: () => set({ isOpen: false }),
      toggleDrawer: () => set((state) => ({ isOpen: !state.isOpen })),
      setDrawerHeight: (height) =>
        set({ drawerHeight: Math.max(TERMINAL_MIN_HEIGHT, Math.round(height)) }),
      openSession: (meta) => {
        const id = meta.id ?? crypto.randomUUID();
        const session: TerminalSessionMeta = {
          id,
          title: meta.title,
          cwd: meta.cwd,
          shell: meta.shell,
          initialInput: meta.initialInput,
          projectId: meta.projectId,
        };
        set((state) => ({
          sessions: [...state.sessions, session],
          activeSessionId: id,
          isOpen: true,
        }));
        return id;
      },
      openDefaultSession: () => {
        const next = defaultNewSession();
        const count = get().sessions.filter((s) => s.shell === next.shell).length;
        return get().openSession({
          title: count === 0 ? next.title : `${next.title} ${count + 1}`,
          shell: next.shell,
        });
      },
      closeSession: (id) => {
        // Ending the shell lives here rather than in the pane's unmount, because a pane
        // also unmounts when the app reloads or React re-runs its effects, and neither of
        // those should cost the user a running shell.
        void window.agentmat.terminal.kill(id);
        set((state) => withoutSession(state, id));
      },
      forgetSession: (id) => set((state) => withoutSession(state, id)),
      setActiveSession: (id) => set({ activeSessionId: id }),
    }),
    {
      name: 'agentmate-terminal-sessions',
      partialize: (state): PersistedTerminalState => ({
        isOpen: state.isOpen,
        drawerHeight: state.drawerHeight,
        activeSessionId: state.activeSessionId,
        // The pre-filled command already ran once; a reconnect must never type it again.
        sessions: state.sessions.map(({ initialInput: _initialInput, ...rest }) => rest),
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedTerminalState>;
        const sessions = Array.isArray(saved.sessions)
          ? saved.sessions.map((session) => ({ ...session, restored: true }))
          : [];
        return {
          ...current,
          isOpen: sessions.length > 0 && saved.isOpen === true,
          drawerHeight:
            typeof saved.drawerHeight === 'number' ? saved.drawerHeight : current.drawerHeight,
          sessions,
          activeSessionId: sessions.some((s) => s.id === saved.activeSessionId)
            ? (saved.activeSessionId ?? null)
            : (sessions.at(-1)?.id ?? null),
        };
      },
    },
  ),
);
