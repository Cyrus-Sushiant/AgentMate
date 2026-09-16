import type { CliArgsMap } from '@agentmat/core';
import type { LastRunInfoByCli } from '@shared/apiTypes';
import { create } from 'zustand';

interface CliState {
  defaultCliId: string | null;
  /** Extra arguments per CLI id, typed as a command line (e.g. "--model sonnet"). */
  cliArgs: CliArgsMap;
  /** The user's order for listing agents to launch. Empty means the default order. */
  cliOrder: string[];
  /** The model and effort each CLI was last actually run on, kept across restarts. */
  lastRunInfoByCli: LastRunInfoByCli;
  setDefaultCliId: (cliId: string | null) => void;
  setCliArgs: (cliId: string, args: string) => void;
  setCliOrder: (order: string[]) => void;
  recordLastRun: (cliId: string, model?: string, effort?: string) => void;
}

export const useCliStore = create<CliState>((set, get) => ({
  defaultCliId: null,
  cliArgs: {},
  cliOrder: [],
  lastRunInfoByCli: {},
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
  recordLastRun: (cliId, model, effort) => {
    if (!model) return;
    const current = get().lastRunInfoByCli[cliId];
    if (current?.model === model && current?.effort === effort) return;
    set({ lastRunInfoByCli: { ...get().lastRunInfoByCli, [cliId]: { model, effort } } });
  },
}));

export async function initDefaultCli(): Promise<void> {
  const [settings, lastRunInfoByCli] = await Promise.all([
    window.agentmat.settings.get(),
    window.agentmat.agents.lastRunInfoByCli(),
  ]);
  useCliStore.setState({
    defaultCliId: settings.defaultCliId,
    cliArgs: settings.cliArgs ?? {},
    cliOrder: settings.cliOrder ?? [],
    lastRunInfoByCli,
  });
}
