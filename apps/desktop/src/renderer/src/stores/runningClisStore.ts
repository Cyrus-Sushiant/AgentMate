import { create } from 'zustand';

interface RunningClisState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** Whether the Running CLIs modal is showing. The header, status bar and palette all open it. */
export const useRunningClisStore = create<RunningClisState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
