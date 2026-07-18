import { create } from 'zustand';

interface PingTargetsState {
  pingTargets: string[];
  setPingTargets: (targets: string[]) => void;
}

export const usePingTargetsStore = create<PingTargetsState>((set) => ({
  pingTargets: ['1.1.1.1'],
  setPingTargets: (targets) => {
    set({ pingTargets: targets });
    void window.agentmat.settings.update({ pingTargets: targets });
  },
}));

export async function initPingTargets(): Promise<void> {
  const settings = await window.agentmat.settings.get();
  usePingTargetsStore.setState({ pingTargets: settings.pingTargets ?? ['1.1.1.1'] });
}
