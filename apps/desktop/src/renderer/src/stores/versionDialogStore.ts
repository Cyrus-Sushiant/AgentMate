import { create } from 'zustand';

interface VersionDialogState {
  /** The project whose "Tag a version" flow is showing, or null when it's closed. */
  openProjectId: string | null;
  open: (projectId: string) => void;
  close: () => void;
}

/**
 * Kept outside the Workspace header so a version-bump run started here can be found again
 * (from a completion toast, say) even after the user has navigated away and the component
 * that opened this dialog has unmounted.
 */
export const useVersionDialogStore = create<VersionDialogState>((set) => ({
  openProjectId: null,
  open: (projectId) => set({ openProjectId: projectId }),
  close: () => set({ openProjectId: null }),
}));
