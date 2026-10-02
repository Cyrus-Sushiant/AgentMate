import { coreErrorMessage } from '@shared/coreErrors';
import type {
  JobInfo,
  StackAction,
  StackDetails,
  StackRevisionInfo,
  StackServiceInfo,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Docker,
  FileCode,
  History,
  Pause,
  Play,
  Power,
  RefreshCw,
  Rocket,
  RotateCw,
  Route,
  Trash2,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import {
  bindingAddress,
  describeBinding,
  REVISION_TEXT,
  REVISION_TONE,
  STATUS_TEXT,
  STATUS_TONE,
} from '@/lib/deploy/apps/format';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/stores/confirmStore';
import { JobLogDialog } from '../overview/JobLogDialog';
import { dateTime } from '../security/format';
import { OPERATOR_ONLY } from './AppsList';
import { DeployTimeline } from './DeployTimeline';
import type { AppsAccess } from './hooks';
import { stackIsBusy, useStack } from './hooks';
import { StatusPill } from './StatusPill';

/**
 * One app: how it is doing, its services and containers, every revision with its deploy
 * timeline and a rollback, the files it runs, and what each role may do with it.
 */

const ADMIN_ONLY = 'Deleting an app with its data needs the Admin role or higher.';

const ACTIONS: ReadonlyArray<{
  action: StackAction;
  label: string;
  icon: typeof Play;
  done: string;
}> = [
  { action: 'start', label: 'Start', icon: Play, done: 'Started' },
  { action: 'stop', label: 'Stop', icon: Pause, done: 'Stopped' },
  { action: 'restart', label: 'Restart', icon: RotateCw, done: 'Restarted' },
  { action: 'down', label: 'Take down', icon: Power, done: 'Took down' },
];

const CONTAINER_STATE: Record<string, string> = {
  created: 'Created',
  running: 'Running',
  paused: 'Paused',
  restarting: 'Restarting',
  removing: 'Removing',
  exited: 'Exited',
  dead: 'Dead',
  unknown: 'Unknown',
};

function DetailSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

function Gate({
  allowed,
  reason,
  children,
}: {
  allowed: boolean;
  reason: string;
  children: React.ReactElement;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={allowed ? null : reason} wrapTrigger>
      {children}
    </SimpleTooltip>
  );
}

function ServicesCard({ services }: { services: StackServiceInfo[] }): React.JSX.Element {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Docker className="h-4 w-4 text-primary" /> Services
        </CardTitle>
        <CardDescription>Each service and the containers it runs right now.</CardDescription>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing runs yet. Deploy a revision first.
          </p>
        ) : (
          <ul aria-label="Services" className="space-y-3">
            {services.map((service) => (
              <li
                key={service.name}
                aria-label={service.name}
                className="rounded-lg border border-border/70 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {service.name}
                  </span>
                  {service.image && (
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {service.image}
                    </span>
                  )}
                </div>
                {service.ports.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-muted-foreground">
                    {service.ports.map((port) => (
                      <span
                        key={`${port.hostIp}-${port.published}-${port.target}-${port.protocol}`}
                      >
                        {describeBinding(port)}
                      </span>
                    ))}
                  </p>
                )}
                {service.containers.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No containers.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {service.containers.map((container) => (
                      <li
                        key={container.id}
                        className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                      >
                        <StatusPill
                          tone={
                            container.state === 'running'
                              ? container.health === 'unhealthy'
                                ? 'warning'
                                : 'success'
                              : container.state === 'dead'
                                ? 'danger'
                                : 'muted'
                          }
                        >
                          {CONTAINER_STATE[container.state] ?? container.state}
                          {container.health !== 'none' ? `, ${container.health}` : ''}
                        </StatusPill>
                        <span className="font-mono text-foreground/90">{container.name}</span>
                        <span className="truncate">{container.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RouteMap({ services }: { services: StackServiceInfo[] }): React.JSX.Element {
  const routes = services.flatMap((service) => service.ports.map((port) => ({ service, port })));
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" /> Route map
        </CardTitle>
        <CardDescription>
          Where each published port leads. Domains are added under Websites, which proxies to these
          ports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {routes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No service publishes a port.</p>
        ) : (
          <ul aria-label="Routes" className="space-y-2">
            {routes.map(({ service, port }) => (
              <li
                key={`${service.name}-${port.hostIp}-${port.published}-${port.target}-${port.protocol}`}
                className="flex flex-wrap items-center gap-2 text-xs"
              >
                <span className="rounded-md border border-dashed border-border px-2 py-1 text-muted-foreground">
                  Domain, via Websites
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="rounded-md border border-border px-2 py-1 font-mono text-foreground">
                  {bindingAddress(port) === 'This server only' ? '127.0.0.1' : (port.hostIp ?? '*')}
                  :{port.published ?? 'any'}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="rounded-md border border-border px-2 py-1 font-mono text-foreground">
                  {service.name}:{port.target}/{port.protocol}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {service.containers.length === 1
                    ? '1 container'
                    : `${service.containers.length} containers`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FilesCard({
  serverId,
  stackId,
  revision,
}: {
  serverId: string;
  stackId: string;
  revision: number;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const files = useQuery({
    queryKey: queryKeys.deployAppFiles(serverId, stackId, revision),
    queryFn: () => window.agentmat.deployStacks.files({ serverId, stackId, revision }),
    enabled: open,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return (
    <Card className="glass">
      <CardHeader>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FileCode className="h-4 w-4 text-primary" />
          <span className="flex-1">
            <CardTitle>Files of revision {revision}</CardTitle>
            <CardDescription>
              The compose file as uploaded, the env keys and the loopback override. Env values stay
              on the server.
            </CardDescription>
          </span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {files.isPending ? (
            <Skeleton className="h-40 w-full" aria-busy="true" />
          ) : files.isError ? (
            <p role="alert" className="text-sm text-muted-foreground">
              The files did not load: {coreErrorMessage(files.error)}
            </p>
          ) : files.data ? (
            <>
              <pre
                aria-label="Compose file"
                className="max-h-80 overflow-auto rounded-lg border border-border bg-secondary/40 p-3 font-mono text-xs"
              >
                {files.data.compose}
              </pre>
              <div>
                <p className="text-xs font-medium text-foreground">Env keys</p>
                {files.data.envKeys.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No .env for this revision.</p>
                ) : (
                  <ul aria-label="Env keys" className="mt-1 flex flex-wrap gap-1">
                    {files.data.envKeys.map((key) => (
                      <li
                        key={key}
                        className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                      >
                        {key}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {files.data.override && (
                <pre
                  aria-label="Loopback override"
                  className="max-h-60 overflow-auto rounded-lg border border-border bg-secondary/40 p-3 font-mono text-xs"
                >
                  {files.data.override}
                </pre>
              )}
            </>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

function RevisionsList({
  revisions,
  shown,
  latest,
  canOperate,
  onShow,
  onRollback,
}: {
  revisions: StackRevisionInfo[];
  shown: number | null;
  latest: number | null;
  canOperate: boolean;
  onShow: (revision: number) => void;
  onRollback: (revision: StackRevisionInfo) => void;
}): React.JSX.Element {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> Revisions
        </CardTitle>
        <CardDescription>
          Every upload is kept. Rolling back deploys an older revision again as a new one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No revisions yet.</p>
        ) : (
          <ul aria-label="Revisions" className="space-y-1">
            {revisions.map((revision) => {
              const canRollBack =
                revision.number !== latest &&
                (revision.state === 'superseded' || revision.state === 'live');
              return (
                <li
                  key={revision.number}
                  aria-label={`Revision ${revision.number}`}
                  className={cn(
                    'flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5',
                    shown === revision.number && 'bg-secondary/60',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onShow(revision.number)}
                    aria-current={shown === revision.number ? 'true' : undefined}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-mono text-sm text-foreground">#{revision.number}</span>
                    <StatusPill tone={REVISION_TONE[revision.state]}>
                      {REVISION_TEXT[revision.state]}
                    </StatusPill>
                    <span className="truncate text-xs text-muted-foreground">
                      {dateTime(revision.createdAtUnixMs)}
                      {revision.createdBy ? `, by ${revision.createdBy}` : ''}
                      {revision.rollbackOf !== undefined
                        ? `, rollback of ${revision.rollbackOf}`
                        : ''}
                    </span>
                  </button>
                  {canRollBack && (
                    <Gate allowed={canOperate} reason={OPERATOR_ONLY}>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!canOperate}
                        onClick={() => onRollback(revision)}
                        aria-label={`Roll back to revision ${revision.number}`}
                      >
                        <History className="h-3.5 w-3.5" /> Roll back
                      </Button>
                    </Gate>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function AppDetail({
  serverId,
  stackId,
  access,
  onBack,
  onDeployAgain,
  onDeleted,
}: {
  serverId: string;
  stackId: string;
  access: AppsAccess;
  onBack: () => void;
  onDeployAgain: (details: StackDetails) => void;
  onDeleted: () => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const details = useStack(serverId, stackId, access.signedIn, busyJob !== null);
  const deleting = useRef(false);
  const [shownRevision, setShownRevision] = useState<number | null>(null);
  const [followJob, setFollowJob] = useState<string | null>(null);
  const [logJob, setLogJob] = useState<JobInfo | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.deployApps(serverId) });
  }, [queryClient, serverId]);

  const data = details.data;
  const stack = data?.stack;
  const revisions = data?.revisions ?? [];
  const latest = revisions[0]?.number ?? null;
  const followed = followJob
    ? revisions.find((revision) => revision.jobId === followJob)
    : undefined;
  const shown =
    followed ??
    revisions.find((revision) => revision.number === shownRevision) ??
    revisions[0] ??
    null;
  const stackBusy = stackIsBusy(data);

  const settled = useCallback(() => {
    setBusyJob(null);
    refresh();
  }, [refresh]);

  async function run(
    label: string,
    work: () => Promise<JobInfo>,
    show: 'log' | 'timeline',
    removing = false,
  ) {
    setWorking(label);
    try {
      const job = await work();
      deleting.current = removing;
      setBusyJob(job.id);
      if (show === 'log') setLogJob(job);
      else {
        setFollowJob(job.id);
        setShownRevision(null);
      }
      refresh();
      return job;
    } catch (error) {
      toast.error(coreErrorMessage(error));
      return null;
    } finally {
      setWorking(null);
    }
  }

  async function rollback(revision: StackRevisionInfo): Promise<void> {
    if (!stack) return;
    const confirmed = await confirmDialog({
      title: `Roll ${stack.name} back to revision ${revision.number}?`,
      description: `Revision ${revision.number}'s files are copied into a new revision and deployed. What runs now is replaced once the new one is healthy.`,
      confirmLabel: 'Roll back',
    });
    if (!confirmed) return;
    await run(
      'rollback',
      () => window.agentmat.deployStacks.rollback({ serverId, stackId, revision: revision.number }),
      'timeline',
    );
  }

  async function action(item: (typeof ACTIONS)[number]): Promise<void> {
    if (!stack) return;
    if (item.action === 'down') {
      const confirmed = await confirmDialog({
        title: `Take ${stack.name} down?`,
        description:
          'Its containers and networks go. Volumes and every revision stay, so a deploy brings it back.',
        confirmLabel: 'Take down',
        variant: 'destructive',
      });
      if (!confirmed) return;
    }
    await run(
      item.action,
      () => window.agentmat.deployStacks.action({ serverId, stackId, action: item.action }),
      'log',
    );
  }

  async function remove(removeVolumes: boolean): Promise<void> {
    if (!stack) return;
    const confirmed = await confirmDialog({
      title: removeVolumes ? `Delete ${stack.name} and its data?` : `Delete ${stack.name}?`,
      description: removeVolumes
        ? 'Its containers, revisions and volumes all go. Whatever the app stored in its volumes is lost.'
        : 'Its containers and revisions go. Its volumes stay on the server, so a new app with the same name finds its data again.',
      warning: removeVolumes ? 'Deleted volumes cannot be brought back.' : undefined,
      confirmLabel: removeVolumes ? 'Delete with its data' : 'Delete the app',
      variant: 'destructive',
      typeToConfirm: removeVolumes ? stack.name : undefined,
    });
    if (!confirmed) return;
    await run(
      removeVolumes ? 'delete-volumes' : 'delete',
      () => window.agentmat.deployStacks.delete({ serverId, stackId, removeVolumes }),
      'log',
      true,
    );
  }

  if (details.isPending) return <DetailSkeleton />;

  if (!data || !stack) {
    return (
      <div className="space-y-3">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> All apps
        </Button>
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"
        >
          <span className="min-w-0 flex-1 text-foreground">
            The app did not load
            {details.error ? `: ${coreErrorMessage(details.error)}` : '.'}
          </span>
          <Button size="sm" variant="outline" onClick={() => void details.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  const canRedeploy = Boolean(stack.source?.projectId && stack.source.composePath);
  const disabled = !access.canOperate || stackBusy || working !== null;
  const why = !access.canOperate
    ? OPERATOR_ONLY
    : stackBusy
      ? 'A job is working on this app. Wait for it to finish.'
      : '';
  const rollbackTarget =
    shown && shown.number !== latest && (shown.state === 'superseded' || shown.state === 'live')
      ? shown
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> All apps
        </Button>
        <h3 className="font-mono text-lg font-semibold text-foreground">{stack.name}</h3>
        <StatusPill tone={STATUS_TONE[stack.status]}>{STATUS_TEXT[stack.status]}</StatusPill>
        <span className="text-xs text-muted-foreground">
          {stack.liveRevision !== undefined
            ? `Revision ${stack.liveRevision} live`
            : 'Nothing live'}
          {stack.containers > 0
            ? `, ${stack.runningContainers} of ${stack.containers} containers running`
            : ''}
        </span>
      </div>
      {stack.source && (
        <p className="text-xs text-muted-foreground">
          From {stack.source.projectName ?? 'a project'}
          {stack.source.composePath ? `, ${stack.source.composePath}` : ''}
          {stack.source.environmentName
            ? `, with the ${stack.source.environmentName} environment`
            : ', without an environment'}
          .
        </p>
      )}
      <div role="toolbar" aria-label="App actions" className="flex flex-wrap gap-2">
        <Gate
          allowed={canRedeploy && !disabled}
          reason={why || 'This app has no project to deploy from on this computer.'}
        >
          <Button size="sm" disabled={disabled || !canRedeploy} onClick={() => onDeployAgain(data)}>
            <Rocket className="h-3.5 w-3.5" /> Deploy again
          </Button>
        </Gate>
        {ACTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <Gate key={item.action} allowed={!disabled} reason={why}>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => void action(item)}
              >
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </Button>
            </Gate>
          );
        })}
        <Gate allowed={!disabled} reason={why}>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={disabled}
            onClick={() => void remove(false)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </Gate>
        <Gate
          allowed={access.canAdmin && !stackBusy && working === null}
          reason={access.canAdmin ? why : ADMIN_ONLY}
        >
          <Button
            size="sm"
            variant="destructive"
            disabled={!access.canAdmin || stackBusy || working !== null}
            onClick={() => void remove(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete with its data
          </Button>
        </Gate>
      </div>
      {shown && (
        <DeployTimeline
          key={`${shown.number}-${shown.jobId ?? 'none'}`}
          serverId={serverId}
          revision={shown}
          canOperate={access.canOperate}
          onSettled={settled}
          onRollback={
            rollbackTarget && access.canOperate ? () => void rollback(rollbackTarget) : undefined
          }
        />
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <ServicesCard services={data.services} />
        <RevisionsList
          revisions={revisions}
          shown={shown?.number ?? null}
          latest={latest}
          canOperate={access.canOperate}
          onShow={(number) => {
            setFollowJob(null);
            setShownRevision(number);
          }}
          onRollback={(revision) => void rollback(revision)}
        />
      </div>
      <RouteMap services={data.services} />
      {shown && <FilesCard serverId={serverId} stackId={stackId} revision={shown.number} />}
      <JobLogDialog
        serverId={serverId}
        job={logJob}
        canCancel={access.canOperate}
        onClose={() => {
          setLogJob(null);
          if (deleting.current) onDeleted();
        }}
        onFinished={(job) => {
          settled();
          if (job.state === 'failed') {
            toast.error(`${job.title} failed${job.error ? `: ${job.error}` : '.'}`);
            deleting.current = false;
          } else if (job.state === 'succeeded' && deleting.current) {
            toast.success(`Deleted ${stack.name}.`);
            setLogJob(null);
            onDeleted();
          }
        }}
      />
    </div>
  );
}
