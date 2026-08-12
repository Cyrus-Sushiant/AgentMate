import { useEffect, useState } from 'react';

export type SystemStatsSample = Awaited<ReturnType<typeof window.agentmat.system.sample>>;

const SAMPLE_INTERVAL_MS = 2000;
const MAX_SAMPLES = 60;

/** Survives unmounts so leaving and reopening the dashboard doesn't wipe the charts. */
let cachedHistory: SystemStatsSample[] = [];

export function useSystemStatsHistory(): SystemStatsSample[] {
  // Seeded from the cache so a revisit redraws the last samples immediately
  // instead of shimmering from scratch while the first new one arrives.
  const [history, setHistory] = useState<SystemStatsSample[]>(cachedHistory);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function tick(): Promise<void> {
      const started = Date.now();
      try {
        const sample = await window.agentmat.system.sample();
        if (cancelled) return;
        setHistory((prev) => {
          const next = [...prev.slice(-(MAX_SAMPLES - 1)), sample];
          cachedHistory = next;
          return next;
        });
      } catch {
        // Transient IPC/ping failures just skip a tick, the chart keeps its history.
      }
      if (cancelled) return;
      const wait = Math.max(0, SAMPLE_INTERVAL_MS - (Date.now() - started));
      timeoutId = setTimeout(() => void tick(), wait);
    }

    void tick();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  return history;
}
