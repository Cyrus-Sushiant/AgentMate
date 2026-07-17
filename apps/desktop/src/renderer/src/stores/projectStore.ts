import { create } from 'zustand';

interface ProjectState {
  activeProjectId: string | null;
  setActiveProjectId: (projectId: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  setActiveProjectId: (projectId) => set({ activeProjectId: projectId }),
}));
