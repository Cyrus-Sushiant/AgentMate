import type { CliArgsMap } from '@agentmat/core';
import { create } from 'zustand';

interface CliState {
  defaultCliId: string | null;
  /** Extra arguments per CLI id, typed as a command line (e.g. "--model sonnet"). */
  cliArgs: CliArgsMap;
  /** The user's order for listing agents to launch. Empty means the default order. */
  cliOrder: string[];
  setDefaultCliId: (cliId: string | null) => void;
  setCliArgs: (cliId: string, args: string) => void;
  setCliOrder: (order: string[]) => void;
}

export const useCliStore = create<CliState>((set, get) => ({
  defaultCliId: null,
  cliArgs: {},
  cliOrder: [],
  setDefaultCliId: (cliId) => {
    set({ defaultCliId: cliId });
    void window.agentmat.settings.update({ defaultCliId: cliId });
  },
  setCliArgs: (cliId, args) => {
    const next = { ...get().cliArgs };
    // An emptied field means "no extra args", so drop the key instead of storing ''.
    if (args.trim()) next[cliId] = args.trim();
    else delete next[cliId];
    set({ cliArgs: next });
    void window.agentmat.settings.update({ cliArgs: next });
  },
  setCliOrder: (order) => {
    set({ cliOrder: order });
    void window.agentmat.settings.update({ cliOrder: order });
  },
}));

export async function initDefaultCli(): Promise<void> {
  const settings = await window.agentmat.settings.get();
  useCliStore.setState({
    defaultCliId: settings.defaultCliId,
    cliArgs: settings.cliArgs ?? {},
    cliOrder: settings.cliOrder ?? [],
  });
}
