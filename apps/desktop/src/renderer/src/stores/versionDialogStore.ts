import { create } from 'zustand';

interface VersionDialogState {
  /** The project whose "Tag a version" flow is showing, or null when it's closed. */
  openProjectId: string | null;
  /**
   * The tag each project is writing into its files, by project id. Kept per project so two
   * projects can each have a version bump going at once, and switching between them never
   * shows one project's run in the other's dialog.
   */
  applyTags: Record<string, string>;
  open: (projectId: string) => void;
  /**
   * Closes the flow for `projectId` only. A run that finishes for one project (a tag created
   * in the background, say) must not close the dialog the user has since opened for another.
   */
  close: (projectId: string) => void;
  setApplyTag: (projectId: string, tag: string | null) => void;
}

/**
 * Kept outside the Workspace header so a version-bump run started here can be found again
 * (from a completion toast, say) even after the user has navigated away and the component
 * that opened this dialog has unmounted.
 */
export const useVersionDialogStore = create<VersionDialogState>((set) => ({
  openProjectId: null,
  applyTags: {},
  open: (projectId) => set({ openProjectId: projectId }),
  close: (projectId) =>
    set((state) => (state.openProjectId === projectId ? { openProjectId: null } : state)),
  setApplyTag: (projectId, tag) =>
    set((state) => {
      const applyTags = { ...state.applyTags };
      if (tag === null) delete applyTags[projectId];
      else applyTags[projectId] = tag;
      return { applyTags };
    }),
}));
