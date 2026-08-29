import type {
  ScannerPreflight,
  SecurityScannerId,
  SecurityScannerSettings,
  SecurityScanOptions,
  SecurityScanProgress,
  SecurityScanRecord,
} from '@agentmat/core';
import { SECURITY_SCANNERS } from '@agentmat/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';

/**
 * The Security tab's data layer: preflight, history, the run itself, and the live progress
 * stream. Kept out of the components so the tab body stays about layout, the same split
 * blueprint/useBlueprint.ts uses.
 */

/**
 * None of these should trip the app-wide boot overlay. A preflight probe spawns a dozen child
 * processes and a scan runs for tens of minutes, so both get per-card shimmer instead.
 */
const QUIET = { meta: { silentLoading: true } } as const;

export interface ScannerProgressState {
  phase: SecurityScanProgress['phase'];
  message: string;
  startedAt: number;
  lines: string[];
}

/** How many output lines to keep per scanner for the log drawer. */
const MAX_LOG_LINES = 200;

export function useSecurityScan(projectId: string) {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, ScannerProgressState>>({});
  const [selectedScanners, setSelectedScanners] = useState<SecurityScannerId[] | null>(null);
  const runIdRef = useRef<string | null>(null);

  const preflightQuery = useQuery({
    queryKey: queryKeys.securityPreflight(projectId),
    queryFn: () => window.agentmat.security.preflight(projectId),
    // Probing six scanners is expensive, and the main process memoizes it anyway.
    staleTime: 30_000,
    ...QUIET,
  });

  const latestQuery = useQuery({
    queryKey: queryKeys.securityLatest(projectId),
    queryFn: () => window.agentmat.security.latest(projectId),
    ...QUIET,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.securityHistory(projectId),
    queryFn: () => window.agentmat.security.history(projectId),
    ...QUIET,
  });

  const configQuery = useQuery({
    queryKey: queryKeys.securityConfig(projectId),
    queryFn: () => window.agentmat.security.getConfig(projectId),
    ...QUIET,
  });

  const preflight = preflightQuery.data ?? [];

  /**
   * Ready scanners are preselected, except the ones that cost money. Strix drives an LLM against
   * the user's own key, so it is always an explicit opt-in.
   */
  const defaultSelection = useMemo(
    () =>
      SECURITY_SCANNERS.filter(
        (scanner) =>
          !scanner.costsMoney && preflight.find((p) => p.scannerId === scanner.id)?.ready,
      ).map((scanner) => scanner.id),
    [preflight],
  );

  const selection = selectedScanners ?? defaultSelection;

  const toggleScanner = useCallback(
    (scannerId: SecurityScannerId) => {
      setSelectedScanners((current) => {
        const base = current ?? defaultSelection;
        return base.includes(scannerId)
          ? base.filter((id) => id !== scannerId)
          : [...base, scannerId];
      });
    },
    [defaultSelection],
  );

  // Live progress. Subscribed for the life of the tab rather than only during a run, so a scan
  // that is already going when the tab is reopened still reports into it.
  useEffect(() => {
    return window.agentmat.security.onScanProgress((payload) => {
      if (payload.projectId !== projectId) return;
      if (runIdRef.current && payload.runId !== runIdRef.current) return;
      if (!payload.scannerId) return;

      setProgress((current) => {
        const scannerId = payload.scannerId as string;
        const existing = current[scannerId];
        const lines = existing ? [...existing.lines, payload.message] : [payload.message];
        return {
          ...current,
          [scannerId]: {
            phase: payload.phase,
            message: payload.message,
            startedAt: existing?.startedAt ?? Date.now(),
            lines: lines.slice(-MAX_LOG_LINES),
          },
        };
      });
    });
  }, [projectId]);

  const runMutation = useMutation({
    mutationFn: async (options: Partial<SecurityScanOptions>): Promise<SecurityScanRecord> => {
      const id = crypto.randomUUID();
      setRunId(id);
      runIdRef.current = id;
      setProgress({});
      return window.agentmat.security.runScan(projectId, options, id);
    },
    onSuccess: (record) => {
      queryClient.setQueryData(queryKeys.securityLatest(projectId), record);
      void queryClient.invalidateQueries({ queryKey: queryKeys.securityHistory(projectId) });
      const failed = record.runs.filter((r) => r.status === 'failed' || r.status === 'timed-out');
      if (record.status === 'cancelled') toast.info('Scan cancelled.');
      else if (failed.length > 0) {
        toast.warning(
          `Scan finished, but ${failed.length} scanner${failed.length === 1 ? '' : 's'} did not complete.`,
        );
      } else {
        toast.success(
          record.findings.length === 0
            ? 'Scan finished with no findings.'
            : `Scan finished with ${record.findings.length} finding${record.findings.length === 1 ? '' : 's'}.`,
        );
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'The scan could not run.');
    },
    onSettled: () => {
      setRunId(null);
      runIdRef.current = null;
    },
    ...QUIET,
  });

  const saveConfig = useMutation({
    mutationFn: (config: SecurityScannerSettings) =>
      window.agentmat.security.setConfig(projectId, config),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.securityConfig(projectId) });
      // A new token or language changes what preflight says, so it has to be re-run.
      void queryClient.invalidateQueries({ queryKey: queryKeys.securityPreflight(projectId) });
    },
    ...QUIET,
  });

  const cancel = useCallback(() => {
    if (runId) void window.agentmat.security.cancelScan(runId);
  }, [runId]);

  const loadScan = useCallback(
    async (id: string) => {
      const record = await window.agentmat.security.getScan(id);
      if (record) queryClient.setQueryData(queryKeys.securityLatest(projectId), record);
    },
    [projectId, queryClient],
  );

  return {
    preflight,
    preflightLoading: preflightQuery.isPending,
    refreshPreflight: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.securityPreflight(projectId) }),
    report: latestQuery.data ?? null,
    reportLoading: latestQuery.isPending,
    history: historyQuery.data ?? [],
    config: configQuery.data ?? {},
    saveConfig,
    selection,
    toggleScanner,
    running: runMutation.isPending,
    progress,
    runScan: runMutation.mutate,
    cancel,
    loadScan,
  };
}

export function preflightFor(
  preflight: ScannerPreflight[],
  scannerId: SecurityScannerId,
): ScannerPreflight | undefined {
  return preflight.find((p) => p.scannerId === scannerId);
}
