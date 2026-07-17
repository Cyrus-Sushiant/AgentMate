import { create } from 'zustand';

interface CliState {
  defaultCliId: string | null;
  setDefaultCliId: (cliId: string | null) => void;
}

export const useCliStore = create<CliState>((set) => ({
  defaultCliId: null,
  setDefaultCliId: (cliId) => {
    set({ defaultCliId: cliId });
    void window.agentmat.settings.update({ defaultCliId: cliId });
  },
}));

export async function initDefaultCli(): Promise<void> {
  const settings = await window.agentmat.settings.get();
  useCliStore.setState({ defaultCliId: settings.defaultCliId });
}
