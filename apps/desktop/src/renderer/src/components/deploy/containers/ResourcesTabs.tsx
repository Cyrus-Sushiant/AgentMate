import { coreErrorMessage } from '@shared/coreErrors';
import type {
  DockerDiskUsageEntry,
  DockerPruneTarget,
  ImageInfo,
  JobInfo,
  NetworkInfo,
  VolumeInfo,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { isImageReference } from '@shared/dockerNames';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { CloudDownload, RefreshCw, Spinner, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { confirmDialog } from '@/stores/confirmStore';
import { ago } from '../security/format';

/**
 * Docker's resources on a server (E06 T7): images (pull one, with its layers in a live log, or
 * remove one), volumes, networks, and how much disk each kind takes with what a prune would free.
 * Removing and pruning ask first; a prune that can take data asks for the server's name.
 */

export interface ResourceRoles {
  canOperate: boolean;
  canAdmin: boolean;
}

function Rows({ count, label }: { count: number; label: string }): React.JSX.Element {
  return (
    <div className="space-y-2" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-lg" />
      ))}
    </div>
  );
}

function Failure({ error, retry }: { error: unknown; retry: () => void }): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {coreErrorMessage(error)}
      <Button size="sm" variant="ghost" className="gap-1.5" onClick={retry}>
        <RefreshCw className="h-3.5 w-3.5" /> Try again
      </Button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

async function attempt(work: () => Promise<unknown>, done: string): Promise<boolean> {
  try {
    await work();
    toast.success(done);
    return true;
  } catch (error) {
    toast.error(coreErrorMessage(error));
    return false;
  }
}

export function ImagesTab({
  serverId,
  roles,
  onJob,
}: {
  serverId: string;
  roles: ResourceRoles;
  onJob: (job: JobInfo) => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const [reference, setReference] = useState('');
  const [pulling, setPulling] = useState(false);
  const images = useQuery({
    queryKey: queryKeys.deployImages(serverId),
    queryFn: () => window.agentmat.deployDocker.listImages(serverId),
    retry: false,
  });
  const valid = isImageReference(reference.trim());

  async function pull(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!valid) return;
    setPulling(true);
    try {
      onJob(
        await window.agentmat.deployDocker.pullImage({ serverId, reference: reference.trim() }),
      );
      setReference('');
    } catch (error) {
      toast.error(coreErrorMessage(error));
    } finally {
      setPulling(false);
    }
  }

  async function remove(image: ImageInfo): Promise<void> {
    const name = image.tags[0] ?? image.id.replace(/^sha256:/, '').slice(0, 12);
    const used = image.containers > 0;
    const confirmed = await confirmDialog({
      title: `Remove ${name}?`,
      description: used
        ? `${image.containers} container${image.containers === 1 ? '' : 's'} on the server use this image. They keep running, but cannot be created again without pulling it.`
        : 'It can be pulled again later.',
      confirmLabel: used ? 'Remove anyway' : 'Remove the image',
      variant: 'destructive',
    });
    if (!confirmed) return;
    if (
      await attempt(
        () => window.agentmat.deployDocker.removeImage({ serverId, image: image.id, force: used }),
        `Removed ${name}.`,
      )
    ) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deployImages(serverId) });
    }
  }

  return (
    <div className="space-y-3">
      {roles.canOperate && (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => void pull(event)}>
          <Input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="nginx:1.29 or ghcr.io/org/app:1.0"
            aria-label="Image to pull"
            className="h-8 max-w-sm font-mono text-xs"
            spellCheck={false}
          />
          <Button type="submit" size="sm" className="gap-1.5" disabled={!valid || pulling}>
            {pulling ? (
              <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />
            ) : (
              <CloudDownload className="h-3.5 w-3.5" />
            )}
            Pull
          </Button>
          {reference.trim() !== '' && !valid && (
            <span className="text-xs text-destructive">That is not an image reference.</span>
          )}
        </form>
      )}
      {images.isPending ? (
        <Rows count={4} label="Loading images" />
      ) : images.error ? (
        <Failure error={images.error} retry={() => void images.refetch()} />
      ) : images.data.length === 0 ? (
        <Empty>No images on this server yet.</Empty>
      ) : (
        <ul className="space-y-1.5" aria-label="Images">
          {images.data.map((image) => (
            <li
              key={image.id}
              aria-label={image.tags[0] ?? image.id}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-foreground">
                  {image.tags.length > 0 ? image.tags.join(', ') : 'No tag'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(image.sizeBytes)}, made {ago(image.createdAtUnixMs)},{' '}
                  {image.containers === 0
                    ? 'not used'
                    : `used by ${image.containers} container${image.containers === 1 ? '' : 's'}`}
                </p>
              </div>
              {roles.canOperate && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  aria-label={`Remove ${image.tags[0] ?? image.id}`}
                  onClick={() => void remove(image)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VolumesTab({
  serverId,
  roles,
}: {
  serverId: string;
  roles: ResourceRoles;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const volumes = useQuery({
    queryKey: queryKeys.deployVolumes(serverId),
    queryFn: () => window.agentmat.deployDocker.listVolumes(serverId),
    retry: false,
  });

  async function remove(volume: VolumeInfo): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Remove the volume ${volume.name}?`,
      description: 'Everything stored in it is deleted.',
      warning: 'Deleted data cannot be brought back.',
      confirmLabel: 'Remove the volume',
      variant: 'destructive',
      typeToConfirm: volume.name,
    });
    if (!confirmed) return;
    if (
      await attempt(
        () =>
          window.agentmat.deployDocker.removeVolume({
            serverId,
            volume: volume.name,
            force: false,
          }),
        `Removed ${volume.name}.`,
      )
    ) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deployVolumes(serverId) });
    }
  }

  if (volumes.isPending) return <Rows count={3} label="Loading volumes" />;
  if (volumes.error) return <Failure error={volumes.error} retry={() => void volumes.refetch()} />;
  if (volumes.data.length === 0) return <Empty>No volumes on this server.</Empty>;
  return (
    <ul className="space-y-1.5" aria-label="Volumes">
      {volumes.data.map((volume) => (
        <li
          key={volume.name}
          aria-label={volume.name}
          className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/60 px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-xs text-foreground">{volume.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[
                volume.composeProject ? `project ${volume.composeProject}` : null,
                volume.sizeBytes !== undefined ? formatBytes(volume.sizeBytes) : null,
                volume.containers === 0
                  ? 'not used'
                  : `used by ${volume.containers} container${volume.containers === 1 ? '' : 's'}`,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
          {roles.canAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              aria-label={`Remove ${volume.name}`}
              disabled={volume.containers > 0}
              onClick={() => void remove(volume)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function NetworksTab({
  serverId,
  roles,
}: {
  serverId: string;
  roles: ResourceRoles;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const networks = useQuery({
    queryKey: queryKeys.deployNetworks(serverId),
    queryFn: () => window.agentmat.deployDocker.listNetworks(serverId),
    retry: false,
  });

  async function remove(network: NetworkInfo): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Remove the network ${network.name}?`,
      description: 'Containers that are not on it are not affected.',
      confirmLabel: 'Remove the network',
      variant: 'destructive',
    });
    if (!confirmed) return;
    if (
      await attempt(
        () => window.agentmat.deployDocker.removeNetwork(serverId, network.name),
        `Removed ${network.name}.`,
      )
    ) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deployNetworks(serverId) });
    }
  }

  if (networks.isPending) return <Rows count={3} label="Loading networks" />;
  if (networks.error)
    return <Failure error={networks.error} retry={() => void networks.refetch()} />;
  if (networks.data.length === 0) return <Empty>No networks on this server.</Empty>;
  return (
    <ul className="space-y-1.5" aria-label="Networks">
      {networks.data.map((network) => (
        <li
          key={network.id}
          aria-label={network.name}
          className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/60 px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-xs text-foreground">
              {network.name}
              {network.builtIn && (
                <span className="ml-2 font-sans text-muted-foreground">Built in</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {[
                network.driver,
                network.internal ? 'internal only' : null,
                network.subnets.join(', ') || null,
                `${network.containers} container${network.containers === 1 ? '' : 's'}`,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
          {roles.canOperate && !network.builtIn && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              aria-label={`Remove ${network.name}`}
              disabled={network.containers > 0}
              onClick={() => void remove(network)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

const DISK_KINDS: Array<{
  key: 'images' | 'containers' | 'volumes' | 'buildCache';
  label: string;
  prune?: DockerPruneTarget;
  what: string;
}> = [
  { key: 'images', label: 'Images', prune: 'images', what: 'images no container uses' },
  { key: 'containers', label: 'Containers', prune: 'containers', what: 'stopped containers' },
  { key: 'volumes', label: 'Volumes', prune: 'volumes', what: 'volumes no container uses' },
  { key: 'buildCache', label: 'Build cache', what: 'the build cache' },
];

export function DiskUsageTab({
  serverId,
  serverName,
  roles,
}: {
  serverId: string;
  serverName: string;
  roles: ResourceRoles;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const [pruning, setPruning] = useState<DockerPruneTarget | null>(null);
  const usage = useQuery({
    queryKey: queryKeys.deployDiskUsage(serverId),
    queryFn: () => window.agentmat.deployDocker.diskUsage(serverId),
    retry: false,
  });

  async function prune(target: DockerPruneTarget, what: string): Promise<void> {
    const takesData = target === 'volumes' || target === 'system';
    const confirmed = await confirmDialog({
      title: target === 'system' ? `Clean up Docker on ${serverName}?` : `Remove ${what}?`,
      description:
        target === 'system'
          ? 'Removes stopped containers, unused networks, images no container uses, the build cache and unused volumes.'
          : `Docker removes ${what} on ${serverName}. Running containers are not touched.`,
      warning: takesData ? 'Data in removed volumes cannot be brought back.' : undefined,
      confirmLabel: target === 'system' ? 'Clean up' : 'Remove',
      variant: 'destructive',
      typeToConfirm: takesData ? serverName : undefined,
    });
    if (!confirmed) return;
    setPruning(target);
    try {
      const result = await window.agentmat.deployDocker.prune({
        serverId,
        target,
        allImages: target === 'images' || target === 'system',
        includeVolumes: target === 'system',
      });
      toast.success(
        `Removed ${result.removed} item${result.removed === 1 ? '' : 's'} and freed ${formatBytes(result.reclaimedBytes)}.`,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.deployDocker(serverId) });
    } catch (error) {
      toast.error(coreErrorMessage(error));
    } finally {
      setPruning(null);
    }
  }

  if (usage.isPending) return <Rows count={4} label="Loading disk use" />;
  if (usage.error) return <Failure error={usage.error} retry={() => void usage.refetch()} />;
  const data = usage.data;
  const total = DISK_KINDS.reduce((sum, kind) => sum + data[kind.key].sizeBytes, 0);
  const free = DISK_KINDS.reduce((sum, kind) => sum + data[kind.key].reclaimableBytes, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Docker uses {formatBytes(total)} on {serverName}; up to {formatBytes(free)} of it could be
        freed.
      </p>
      <div className="grid gap-3 sm:grid-cols-2" role="list" aria-label="Disk use">
        {DISK_KINDS.map((kind) => {
          const entry: DockerDiskUsageEntry = data[kind.key];
          return (
            <Card key={kind.key} role="listitem" aria-label={kind.label} className="space-y-2 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{kind.label}</span>
                <span className="text-sm tabular-nums text-foreground">
                  {formatBytes(entry.sizeBytes)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {entry.count} in all, {entry.active} in use, {formatBytes(entry.reclaimableBytes)}{' '}
                could be freed
              </p>
              {roles.canAdmin && kind.prune && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={pruning !== null || entry.reclaimableBytes === 0}
                  onClick={() => void prune(kind.prune as DockerPruneTarget, kind.what)}
                >
                  {pruning === kind.prune ? (
                    <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remove {kind.what}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
      {roles.canAdmin && (
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5"
          disabled={pruning !== null}
          onClick={() => void prune('system', 'everything unused')}
        >
          {pruning === 'system' ? (
            <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Clean up everything unused
        </Button>
      )}
    </div>
  );
}
