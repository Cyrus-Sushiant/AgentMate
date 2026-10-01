import { coreErrorMessage } from '@shared/coreErrors';
import type {
  AlertInfo,
  JobInfo,
  ManagedService,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type { DeployCoreRecord, DeployServer } from '@shared/deployTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bolt, HardDrive, MemoryStick, Package, Spinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { healthScore } from '@/lib/deploy/overview/health';
import { swapPercent, wholePercent } from '@/lib/deploy/overview/metrics';
import { queryKeys } from '@/lib/queryKeys';
import { confirmDialog } from '@/stores/confirmStore';
import { CoreAccessCard } from '../CoreAccessCard';
import { CoreHealthCard } from '../CoreHealthCard';
import { hasRole } from '../security/format';
import { AlertsCard } from './AlertsCard';
import { useDeployConnection, useJobLog, useLiveAlerts, useLiveSamples } from './hooks';
import { JobLogDialog } from './JobLogDialog';
import { MetricsCard } from './MetricsCard';
import { PulseHeader } from './PulseHeader';
import { ServicesCard } from './ServicesCard';
import { SystemFactsCard } from './SystemFactsCard';
import { UpdatesCard, type UpgradeKind } from './UpdatesCard';
import { useProofStepUp } from './useProofStepUp';

/**
 * A server's Overview (E05 T10): the pulse and health score, the charts, what the server is, its
 * services, alerts and updates, and a reboot that waits for the server to come back. It shows
 * what the signed-in role may use; the core checks every call again. While the connection is
 * being tried again, everything stays on screen, dimmed, and fills in again once it is back.
 */

const PACKAGE_JOBS = new Set<JobInfo['kind']>([
  'packagesRefresh',
  'packagesUpgrade',
  'packagesUpgradeSecurity',
  'automaticUpdates',
  'reboot',
]);
/** How long a reboot may take to drop the connection before the banner gives up on it. */
const REBOOT_DROP_MS = 120_000;

type RebootPhase = 'starting' | 'down' | null;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Follows a job nobody needs to watch (a check, a setting) and says when it is done. */
function QuietJob({
  serverId,
  job,
  onFinished,
}: {
  serverId: string;
  job: JobInfo;
  onFinished: (job: JobInfo) => void;
}): null {
  const log = useJobLog(serverId, job);
  const current = log.job ?? job;
  const done = useRef(false);
  useEffect(() => {
    if (done.current || (current.state === 'running' && !log.ended)) return;
    done.current = true;
    onFinished(current);
  }, [current, log.ended, onFinished]);
  return null;
}

export function OverviewPanel({
  server,
  core,
  onReinstall,
  onRemove,
}: {
  server: DeployServer;
  core: DeployCoreRecord;
  onReinstall?: () => void;
  onRemove?: (keepData: boolean) => void;
}): React.JSX.Element {
  const serverId = server.id;
  const queryClient = useQueryClient();
  const now = useNow(15_000);
  const stepUp = useProofStepUp(server);

  const access = useQuery({
    queryKey: queryKeys.deployAccess(serverId),
    queryFn: () => window.agentmat.deploy.access(serverId),
    retry: false,
    staleTime: 30_000,
  });
  const signedIn = access.data?.state === 'signed-in';
  const roles = access.data?.user?.roles;
  const canOperate = hasRole(roles, 'operator');
  const canAdmin = hasRole(roles, 'admin');

  const connection = useDeployConnection(serverId, signedIn);
  const stale = connection?.state === 'reconnecting';

  const read = { enabled: signedIn, retry: false } as const;
  const info = useQuery({
    ...read,
    queryKey: queryKeys.deploySystemInfo(serverId),
    queryFn: () => window.agentmat.deploySystem.info(serverId),
    refetchInterval: 5 * 60_000,
  });
  const services = useQuery({
    ...read,
    queryKey: queryKeys.deployServices(serverId),
    queryFn: () => window.agentmat.deploySystem.services(serverId),
    refetchInterval: 60_000,
  });
  const updates = useQuery({
    ...read,
    queryKey: queryKeys.deployUpdates(serverId),
    queryFn: () => window.agentmat.deploySystem.updates(serverId),
  });
  const activeJobs = useQuery({
    ...read,
    queryKey: queryKeys.deployActiveJobs(serverId),
    queryFn: async () =>
      (await window.agentmat.deployJobs.list({ serverId, activeOnly: true, limit: 10 }))?.jobs ??
      [],
    refetchInterval: 30_000,
  });
  const live = useLiveSamples(serverId, signedIn);
  const alerts = useLiveAlerts(serverId, signedIn);

  const [logJob, setLogJob] = useState<JobInfo | null>(null);
  const [quietJob, setQuietJob] = useState<JobInfo | null>(null);
  const [restarting, setRestarting] = useState<ManagedService | null>(null);
  const [acknowledging, setAcknowledging] = useState<number | null>(null);
  const [reboot, setReboot] = useState<RebootPhase>(null);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.deployOverview(serverId) });
  }, [queryClient, serverId]);

  // The reboot banner follows the connection: it drops, then comes back by itself.
  const state = connection?.state;
  useEffect(() => {
    if (reboot === 'starting' && state !== undefined && state !== 'online') setReboot('down');
    if (reboot === 'down' && state === 'online') {
      setReboot(null);
      toast.success(`${server.nickname} is back.`);
      refresh();
    }
  }, [reboot, state, server.nickname, refresh]);
  useEffect(() => {
    if (reboot !== 'starting') return;
    const timer = setTimeout(() => setReboot(null), REBOOT_DROP_MS);
    return () => clearTimeout(timer);
  }, [reboot]);

  const finished = useCallback(
    (job: JobInfo) => {
      refresh();
      if (job.state === 'failed')
        toast.error(`${job.title} failed${job.error ? `: ${job.error}` : '.'}`);
    },
    [refresh],
  );

  async function start(
    work: () => Promise<JobInfo | undefined>,
    show: 'log' | 'quiet' | 'none',
  ): Promise<JobInfo | undefined> {
    try {
      const job = await work();
      if (!job) return undefined;
      if (show === 'log') setLogJob(job);
      else if (show === 'quiet') setQuietJob(job);
      void queryClient.invalidateQueries({ queryKey: queryKeys.deployActiveJobs(serverId) });
      return job;
    } catch (error) {
      toast.error(coreErrorMessage(error));
      return undefined;
    }
  }

  function upgrade(kind: UpgradeKind): void {
    void start(
      () =>
        kind === 'security'
          ? window.agentmat.deploySystem.upgradeSecurity(serverId)
          : stepUp.run(
              (proof) => window.agentmat.deploySystem.upgradeAll({ serverId, ...proof }),
              'Installing every update',
            ),
      'log',
    );
  }

  async function restart(service: ManagedService): Promise<void> {
    setRestarting(service);
    try {
      await start(() => window.agentmat.deploySystem.restartService(serverId, service), 'log');
    } finally {
      setRestarting(null);
    }
  }

  async function acknowledge(alert: AlertInfo): Promise<void> {
    setAcknowledging(alert.id);
    try {
      alerts.merge(await window.agentmat.deployAlerts.acknowledge(serverId, alert.id));
    } catch (error) {
      toast.error(coreErrorMessage(error));
    } finally {
      setAcknowledging(null);
    }
  }

  async function rebootServer(): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Reboot ${server.nickname}?`,
      description:
        'Everything on the server stops and starts again, so websites and apps are down until it is back, usually within a couple of minutes. This page reconnects by itself.',
      confirmLabel: 'Reboot',
      variant: 'destructive',
      typeToConfirm: server.nickname,
    });
    if (!confirmed) return;
    const job = await start(
      () =>
        stepUp.run(
          (proof) => window.agentmat.deploySystem.reboot({ serverId, ...proof }),
          'Rebooting',
        ),
      'none',
    );
    if (job) setReboot('starting');
  }

  const coreCards = (
    <>
      <CoreHealthCard server={server} core={core} onReinstall={onReinstall} onRemove={onRemove} />
      <CoreAccessCard server={server} />
    </>
  );

  if (access.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-lg" aria-busy="true" />
        {coreCards}
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sign in to see {server.nickname} live: its charts, services, alerts and updates.
        </p>
        {coreCards}
      </div>
    );
  }

  const samples = live.samples;
  const latest = samples.at(-1);
  const health = healthScore({
    sample: latest,
    recent: samples.slice(-30),
    info: info.data,
    updates: updates.data,
    alerts: alerts.open,
    services: services.data,
  });
  const fullest = [...(info.data?.disks ?? [])]
    .filter((disk) => disk.totalBytes > 0)
    .sort((a, b) => b.usedBytes / b.totalBytes - a.usedBytes / a.totalBytes)[0];
  const running = (activeJobs.data ?? []).filter((job) => job.state === 'running');
  const packageBusy =
    running.some((job) => PACKAGE_JOBS.has(job.kind)) ||
    (logJob !== null && PACKAGE_JOBS.has(logJob.kind) && logJob.state === 'running') ||
    reboot !== null;
  const shown = running.filter((job) => job.id !== logJob?.id && job.id !== quietJob?.id);
  const error = (query: { error: unknown }) => (query.error ? coreErrorMessage(query.error) : null);

  return (
    <div className="space-y-4">
      {reboot && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm"
        >
          <Spinner className="h-4 w-4 shrink-0 text-warning motion-safe:animate-spin" />
          {reboot === 'starting'
            ? `${server.nickname} is about to reboot. This page reconnects by itself when it is back.`
            : `Waiting for ${server.nickname} to come back. This page reconnects by itself.`}
        </div>
      )}
      {shown.map((job) => (
        <div
          key={job.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
        >
          <Spinner className="h-3.5 w-3.5 text-muted-foreground motion-safe:animate-spin" />
          <span className="min-w-0 flex-1">
            Running: {job.title}
            {job.requestedBy ? `, started by ${job.requestedBy}` : ''}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setLogJob(job)}>
            Show the log
          </Button>
        </div>
      ))}
      <PulseHeader samples={samples} ready={live.ready} health={health} connection={state} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<Bolt className="h-3.5 w-3.5" />}
          label="Load, 1 / 5 / 15 min"
          value={
            latest ? (
              <span className="flex flex-wrap items-baseline gap-x-2">
                {latest.load1.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">
                  {latest.load5.toFixed(2)} / {latest.load15.toFixed(2)}
                </span>
              </span>
            ) : live.ready ? (
              'No data'
            ) : (
              <Skeleton className="h-7 w-24" />
            )
          }
        />
        <StatTile
          icon={<HardDrive className="h-3.5 w-3.5" />}
          label={fullest ? `Disk ${fullest.mountPoint}` : 'Disk'}
          value={
            fullest ? (
              wholePercent((fullest.usedBytes / fullest.totalBytes) * 100)
            ) : info.isPending ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              'No data'
            )
          }
        />
        <StatTile
          icon={<MemoryStick className="h-3.5 w-3.5" />}
          label="Swap in use"
          value={
            latest ? (
              latest.swapTotalBytes > 0 ? (
                wholePercent(swapPercent(latest))
              ) : (
                'No swap'
              )
            ) : live.ready ? (
              'No data'
            ) : (
              <Skeleton className="h-7 w-16" />
            )
          }
        />
        <StatTile
          icon={<Package className="h-3.5 w-3.5" />}
          label="Updates waiting"
          value={
            updates.data ? (
              `${updates.data.packages.length}${updates.data.securityCount > 0 ? `, ${updates.data.securityCount} security` : ''}`
            ) : updates.isPending ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              'No data'
            )
          }
        />
      </div>
      <AlertsCard
        alerts={alerts.open}
        ready={alerts.ready}
        error={alerts.error}
        now={now}
        acknowledging={acknowledging}
        onAcknowledge={canOperate ? (alert) => void acknowledge(alert) : undefined}
      />
      <MetricsCard
        serverId={serverId}
        live={samples}
        liveReady={live.ready}
        liveError={live.error}
        stale={stale}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SystemFactsCard
          info={info.data}
          loading={info.isPending}
          error={error(info)}
          stale={stale}
          now={now}
          rebooting={reboot !== null}
          onReboot={canOperate ? () => void rebootServer() : undefined}
        />
        <div className="space-y-4">
          <UpdatesCard
            updates={updates.data}
            loading={updates.isPending}
            error={error(updates)}
            stale={stale}
            now={now}
            checking={quietJob?.kind === 'packagesRefresh'}
            busy={packageBusy}
            canOperate={canOperate}
            canAdmin={canAdmin}
            onCheck={() =>
              void start(() => window.agentmat.deploySystem.checkUpdates(serverId), 'quiet')
            }
            onUpgrade={upgrade}
            onAutomatic={(enabled) =>
              void start(
                () => window.agentmat.deploySystem.setAutomaticUpdates(serverId, enabled),
                'quiet',
              )
            }
          />
          <ServicesCard
            services={services.data}
            loading={services.isPending}
            error={error(services)}
            stale={stale}
            restarting={restarting}
            onRestart={canOperate ? (service) => void restart(service) : undefined}
          />
        </div>
      </div>
      {coreCards}
      {quietJob && (
        <QuietJob
          serverId={serverId}
          job={quietJob}
          onFinished={(job) => {
            setQuietJob(null);
            finished(job);
          }}
        />
      )}
      <JobLogDialog
        serverId={serverId}
        job={logJob}
        canCancel={canOperate}
        onClose={() => setLogJob(null)}
        onFinished={finished}
      />
      {stepUp.dialog}
    </div>
  );
}
