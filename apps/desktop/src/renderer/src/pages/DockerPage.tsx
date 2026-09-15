import type { DockerContainer } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DockerContainerRow } from '@/components/docker/DockerContainerRow';
import { RemoveContainerDialog } from '@/components/docker/RemoveContainerDialog';
import { useDockerContainerActions } from '@/components/docker/useDockerContainerActions';
import { Docker, RefreshCw, Search, X } from '@/components/icons';
import { ProjectEmptyState } from '@/components/projects/ProjectDetailChrome';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { queryKeys } from '@/lib/queryKeys';

function matchesQuery(container: DockerContainer, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return container.name.toLowerCase().includes(q) || container.image.toLowerCase().includes(q);
}

function groupByComposeProject(
  containers: DockerContainer[],
): { label: string | null; containers: DockerContainer[] }[] {
  const grouped = new Map<string, DockerContainer[]>();
  const ungrouped: DockerContainer[] = [];
  for (const container of containers) {
    if (!container.composeProject) {
      ungrouped.push(container);
      continue;
    }
    const list = grouped.get(container.composeProject) ?? [];
    list.push(container);
    grouped.set(container.composeProject, list);
  }
  const groups: { label: string | null; containers: DockerContainer[] }[] = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, list]) => ({ label, containers: list }));
  if (ungrouped.length > 0) groups.push({ label: null, containers: ungrouped });
  return groups;
}

function DockerPageSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function DockerPage(): React.JSX.Element {
  const [query, setQuery] = useState('');

  const availabilityQuery = useQuery({
    queryKey: queryKeys.dockerAvailability,
    queryFn: () => window.agentmat.docker.availability(),
    meta: { silentLoading: true },
  });
  const available = availabilityQuery.data;

  const listQuery = useQuery({
    queryKey: queryKeys.dockerList,
    queryFn: () => window.agentmat.docker.list(),
    enabled: available === true,
    refetchInterval: available === true ? 4000 : false,
    meta: { silentLoading: true },
  });

  const actions = useDockerContainerActions(queryKeys.dockerList);

  if (availabilityQuery.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <DockerPageSkeleton />
      </div>
    );
  }

  if (available === false) {
    return (
      <div className="space-y-6 p-6">
        <ProjectEmptyState
          icon={Docker}
          title="Docker isn't available"
          description="AgentMate couldn't find the docker command on PATH. Install Docker Desktop (or the Docker Engine CLI) and reopen this page."
        />
      </div>
    );
  }

  const containers = listQuery.data ?? [];
  const runningCount = containers.filter((c) => c.state === 'running').length;
  const search = query.trim();
  const visible = containers.filter((c) => matchesQuery(c, search));
  const groups = groupByComposeProject(visible);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            icon={<Docker className="h-3.5 w-3.5" />}
            label="Running"
            value={listQuery.isLoading ? <Skeleton className="h-6 w-8" /> : runningCount}
          />
          <StatTile
            icon={<Docker className="h-3.5 w-3.5" />}
            label="Stopped"
            value={
              listQuery.isLoading ? (
                <Skeleton className="h-6 w-8" />
              ) : (
                containers.length - runningCount
              )
            }
          />
          <StatTile
            icon={<Docker className="h-3.5 w-3.5" />}
            label="Total"
            value={listQuery.isLoading ? <Skeleton className="h-6 w-8" /> : containers.length}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={listQuery.isFetching}
          aria-busy={listQuery.isFetching}
          onClick={() => void listQuery.refetch()}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${listQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search containers or images"
          aria-label="Search containers"
          className="h-8 pl-8 pr-8"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setQuery('')}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {listQuery.isLoading ? (
        <DockerPageSkeleton />
      ) : containers.length === 0 ? (
        <ProjectEmptyState
          icon={Docker}
          title="No containers on this machine"
          description="Containers you create or run with Docker will show up here."
        />
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No containers match "{search}".</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label ?? 'ungrouped'} className="space-y-2">
              {group.label && (
                <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
              )}
              {group.containers.map((container) => (
                <DockerContainerRow
                  key={container.id}
                  container={container}
                  pending={actions.pendingId === container.id}
                  onStart={() => actions.start(container.id)}
                  onStop={() => actions.stop(container.id)}
                  onRestart={() => actions.restart(container.id)}
                  onRemove={() => actions.openRemoveDialog(container)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <RemoveContainerDialog
        containerName={actions.removeTarget?.name ?? null}
        open={actions.removeTarget !== null}
        removing={actions.removing}
        onOpenChange={(open) => {
          if (!open) actions.closeRemoveDialog();
        }}
        onConfirm={actions.confirmRemove}
      />
    </div>
  );
}
