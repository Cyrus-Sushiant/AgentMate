import { create } from 'zustand';

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
  sessions: TerminalSessionMeta[];
  activeSessionId: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  openSession: (meta: Omit<TerminalSessionMeta, 'id'> & { id?: string }) => string;
  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  isOpen: false,
  sessions: [],
  activeSessionId: null,
  openDrawer: () => set({ isOpen: true }),
  closeDrawer: () => set({ isOpen: false }),
  toggleDrawer: () => set((state) => ({ isOpen: !state.isOpen })),
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
