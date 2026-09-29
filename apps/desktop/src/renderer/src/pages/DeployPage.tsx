import type { DeployServer } from '@shared/deployTypes';
import { sshErrorMessage } from '@shared/sshErrors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CoreAccessCard } from '@/components/deploy/CoreAccessCard';
import { CoreHealthCard } from '@/components/deploy/CoreHealthCard';
import { InstallPanel } from '@/components/deploy/InstallPanel';
import { RemovalPanel } from '@/components/deploy/RemovalPanel';
import { ServerRail } from '@/components/deploy/ServerRail';
import { SetupFailure } from '@/components/deploy/SetupFailure';
import { Lock, RefreshCw, Server } from '@/components/icons';
import { ProjectEmptyState } from '@/components/projects/ProjectDetailChrome';
import { SshVaultUnlockDialog } from '@/components/remote/SshVaultUnlockDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import { confirmDialog } from '@/stores/confirmStore';
import { useDeploySetupStore } from '@/stores/deploySetupStore';
import { usePageHeader } from '@/stores/pageHeaderStore';

function DeployPageSkeleton(): React.JSX.Element {
  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[17rem_minmax(0,1fr)]" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}

function ServerHeader({ server }: { server: DeployServer }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Server className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-foreground">{server.nickname}</h2>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {server.username}@{server.host}:{server.port}
        </p>
      </div>
      {server.dev && <Badge variant="warning">Development</Badge>}
    </div>
  );
}

/**
 * Turns finished installs and removals into a fresh server list and a message, once each, even
 * when they finished while the page was closed.
 */
function useFinishedRuns(onFinished: (serverId: string) => void): void {
  const runs = useDeploySetupStore((state) => state.runs);
  const clear = useDeploySetupStore((state) => state.clear);
  const queryClient = useQueryClient();
  const handling = useRef(new Set<string>());
  const finished = useRef(onFinished);
  finished.current = onFinished;

  useEffect(() => {
    for (const [serverId, run] of Object.entries(runs)) {
      if (run.status !== 'done' || handling.current.has(serverId)) continue;
      handling.current.add(serverId);
      const servers = queryClient.getQueryData<DeployServer[]>(queryKeys.deployServers) ?? [];
      const name = servers.find((server) => server.id === serverId)?.nickname ?? 'the server';
      toast.success(
        run.kind === 'uninstall'
          ? `Removed the server core from ${name}.`
          : run.result
            ? `Server core ${run.result.version} is running on ${name}.`
            : `The server core is running on ${name}.`,
      );
      if (run.result?.enrollmentError) {
        toast.warning(
          `Your access to ${name} is not set up yet: ${run.result.enrollmentError} Set it up from the server card.`,
        );
      }
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.deployServers }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deployHealth(serverId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deployAccess(serverId) }),
      ]).finally(() => {
        handling.current.delete(serverId);
        clear(serverId);
        queryClient.removeQueries({ queryKey: queryKeys.deployPreflight(serverId) });
        finished.current(serverId);
      });
    }
  }, [runs, clear, queryClient]);
}

export default function DeployPage(): React.JSX.Element {
  usePageHeader('Deploy', 'Install the server core on your servers and keep an eye on them.');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [updating, setUpdating] = useState<string | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const queryClient = useQueryClient();
  const runs = useDeploySetupStore((state) => state.runs);
  const uninstall = useDeploySetupStore((state) => state.uninstall);

  const serversQuery = useQuery({
    queryKey: queryKeys.deployServers,
    queryFn: () => window.agentmat.deploy.listServers(),
  });
  const vaultQuery = useQuery({
    queryKey: queryKeys.sshVaultStatus,
    queryFn: () => window.agentmat.ssh.vaultStatus(),
  });
  useFinishedRuns((serverId) => setUpdating((current) => (current === serverId ? null : current)));

  if (serversQuery.isPending) return <DeployPageSkeleton />;

  if (serversQuery.isError) {
    return (
      <div className="space-y-3 p-6">
        <SetupFailure message={sshErrorMessage(serversQuery.error)} />
        <Button size="sm" variant="outline" onClick={() => void serversQuery.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  }

  const servers = serversQuery.data;
  if (servers.length === 0) {
    return (
      <div className="p-6">
        <ProjectEmptyState
          icon={Server}
          title="No servers yet"
          description="Deploy works with the servers you save in Remote. Add one there, then come back to install the server core on it."
          action={
            <Button size="sm" onClick={() => navigate('/remote')}>
              <Server className="h-3.5 w-3.5" /> Open Remote
            </Button>
          }
        />
      </div>
    );
  }

  const selected = servers.find((server) => server.id === params.get('server')) ?? servers[0];
  const run = runs[selected.id];
  const locked = vaultQuery.data?.hasPasskey === true && !vaultQuery.data.unlocked;

  async function remove(server: DeployServer, keepData: boolean): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Remove the server core from ${server.nickname}?`,
      description: keepData
        ? 'The service and the program go. Its data folder and settings stay, so a later install picks up where this one left off.'
        : 'The service, the program, its data folder and its settings all go. Nothing of the core is left on the server.',
      warning: keepData ? undefined : 'Deleted data cannot be brought back.',
      confirmLabel: keepData ? 'Remove the core' : 'Remove the core and its data',
      variant: 'destructive',
    });
    if (confirmed) void uninstall(server.id, keepData, null);
  }

  let content: React.ReactNode;
  if (run?.kind === 'uninstall') {
    content = <RemovalPanel server={selected} run={run} />;
  } else if (!selected.core || updating === selected.id || run?.kind === 'install') {
    content = (
      <InstallPanel
        server={selected}
        onCancel={selected.core ? () => setUpdating(null) : undefined}
      />
    );
  } else {
    content = (
      <>
        <CoreHealthCard
          server={selected}
          core={selected.core}
          onReinstall={selected.dev ? undefined : () => setUpdating(selected.id)}
          onRemove={selected.dev ? undefined : (keepData) => void remove(selected, keepData)}
        />
        <CoreAccessCard server={selected} />
      </>
    );
  }

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <ServerRail
        servers={servers}
        selectedId={selected.id}
        onSelect={(serverId) => setParams({ server: serverId }, { replace: true })}
      />
      <div className="min-w-0 space-y-4">
        {locked && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
            <Lock className="h-4 w-4 shrink-0 text-warning" />
            <p className="min-w-0 flex-1 text-sm text-foreground">
              Your saved servers are locked with a passkey. Unlock them to reach their cores.
            </p>
            <Button size="sm" onClick={() => setUnlockOpen(true)}>
              Unlock
            </Button>
          </div>
        )}
        <ServerHeader server={selected} />
        {content}
      </div>
      <SshVaultUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        mode="unlock"
        onUnlocked={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.sshVaultStatus });
          void queryClient.invalidateQueries({ queryKey: ['deploy'] });
        }}
      />
    </div>
  );
}
