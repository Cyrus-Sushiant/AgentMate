import type { PingMethod } from '@agentmat/core';
import { create } from 'zustand';

export const DEFAULT_PING_URL = 'https://www.gstatic.com/generate_204';
export const DEFAULT_PING_URL_INTERVAL_SECONDS = 5;
export const MIN_PING_URL_INTERVAL_SECONDS = 1;
export const MAX_PING_URL_INTERVAL_SECONDS = 300;

interface PingTargetsState {
  pingTargets: string[];
  pingMethod: PingMethod;
  pingUrls: string[];
  pingUrlIntervalSeconds: number;
  setPingTargets: (targets: string[]) => void;
  setPingMethod: (method: PingMethod) => void;
  setPingUrls: (urls: string[]) => void;
  setPingUrlIntervalSeconds: (seconds: number) => void;
}

export const usePingTargetsStore = create<PingTargetsState>((set) => ({
  pingTargets: ['1.1.1.1'],
  pingMethod: 'icmp',
  pingUrls: [DEFAULT_PING_URL],
  pingUrlIntervalSeconds: DEFAULT_PING_URL_INTERVAL_SECONDS,
  setPingTargets: (targets) => {
    set({ pingTargets: targets });
    void window.agentmat.settings.update({ pingTargets: targets });
  },
  setPingMethod: (method) => {
    set({ pingMethod: method });
    void window.agentmat.settings.update({ pingMethod: method });
  },
  setPingUrls: (urls) => {
    set({ pingUrls: urls });
    void window.agentmat.settings.update({ pingUrls: urls });
  },
  setPingUrlIntervalSeconds: (seconds) => {
    set({ pingUrlIntervalSeconds: seconds });
    void window.agentmat.settings.update({ pingUrlIntervalSeconds: seconds });
  },
}));

export async function initPingTargets(): Promise<void> {
  const settings = await window.agentmat.settings.get();
  usePingTargetsStore.setState({
    pingTargets: settings.pingTargets ?? ['1.1.1.1'],
    pingMethod: settings.pingMethod ?? 'icmp',
    pingUrls: settings.pingUrls ?? [DEFAULT_PING_URL],
    pingUrlIntervalSeconds:
      settings.pingUrlIntervalSeconds ?? DEFAULT_PING_URL_INTERVAL_SECONDS,
  });
}
