import { useEffect, useState } from 'react';

export type SystemStatsSample = Awaited<ReturnType<typeof window.agentmat.system.sample>>;

const SAMPLE_INTERVAL_MS = 2000;
const MAX_SAMPLES = 60;

export function useSystemStatsHistory(): SystemStatsSample[] {
  const [history, setHistory] = useState<SystemStatsSample[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll(): Promise<void> {
      try {
        const sample = await window.agentmat.system.sample();
        if (cancelled) return;
        setHistory((prev) => [...prev.slice(-(MAX_SAMPLES - 1)), sample]);
      } catch {
        // Transient IPC/ping failures just skip a tick — the chart keeps its history.
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), SAMPLE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return history;
}
