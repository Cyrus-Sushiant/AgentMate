import { create } from 'zustand';

export const TERMINAL_MIN_HEIGHT = 160;
export const TERMINAL_DEFAULT_HEIGHT = 288;

export interface TerminalSessionMeta {
  id: string;
  title: string;
  cwd?: string;
  shell?: string;
  initialInput?: string;
  projectId?: string;
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
  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
}

/** The shell a plain "new tab" starts, per platform. */
export function defaultNewSession(): { title: string; shell?: string } {
  const platform = window.agentmat.platform;
  if (platform === 'win32') return { title: 'PowerShell', shell: 'powershell.exe' };
  if (platform === 'darwin') return { title: 'zsh', shell: 'zsh' };
  return { title: 'bash', shell: 'bash' };
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
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
    const { sessions, activeSessionId } = get();
    const remaining = sessions.filter((s) => s.id !== id);
    set({
      sessions: remaining,
      activeSessionId: activeSessionId === id ? (remaining.at(-1)?.id ?? null) : activeSessionId,
    });
  },
  setActiveSession: (id) => set({ activeSessionId: id }),
}));
