import { create } from 'zustand';

/**
 * Which worktree dialog is open. The rail, the header switcher, the panel, branch menus and
 * shortcuts all open the same two dialogs, so they live once in the workspace and are asked for
 * through here.
 */

export interface CreateWorktreeRequest {
  projectId: string;
  /** Prefills the branch, e.g. "Create worktree from branch" in the branch list. */
  branch?: string;
  mode?: 'new' | 'existing';
}

export interface RemoveWorktreeRequest {
  projectId: string;
  worktreeId: string;
}

interface WorktreeDialogState {
  create: CreateWorktreeRequest | null;
  remove: RemoveWorktreeRequest | null;
  openCreate: (request: CreateWorktreeRequest) => void;
  openRemove: (request: RemoveWorktreeRequest) => void;
  closeCreate: () => void;
  closeRemove: () => void;
}

export const useWorktreeDialogStore = create<WorktreeDialogState>((set) => ({
  create: null,
  remove: null,
  openCreate: (request) => set({ create: request }),
  openRemove: (request) => set({ remove: request }),
  closeCreate: () => set({ create: null }),
  closeRemove: () => set({ remove: null }),
}));
