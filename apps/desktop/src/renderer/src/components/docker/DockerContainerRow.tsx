import type { DockerContainer } from '@shared/apiTypes';
import { Docker as DockerIcon, Play, RefreshCw, StopCircle, Trash2 } from '@/components/icons';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const STATE_BADGE_VARIANT: Record<DockerContainer['state'], BadgeProps['variant']> = {
  running: 'success',
  restarting: 'warning',
  exited: 'outline',
  dead: 'outline',
  paused: 'outline',
  created: 'outline',
};

const STATE_LABEL: Record<DockerContainer['state'], string> = {
  running: 'Running',
  restarting: 'Restarting',
  exited: 'Exited',
  dead: 'Dead',
  paused: 'Paused',
  created: 'Created',
};

function formatMem(bytes: number): string {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function UsageBar({ percent }: { percent: number }): React.JSX.Element {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-foreground/10">
      <span
        className="block h-full rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

/**
 * One container, shared between the machine-wide Docker page and a project's Docker tab so the
 * two views can't drift apart.
 */
export function DockerContainerRow({
  container,
  pending,
  focused = false,
  rowRef,
  onStart,
  onStop,
  onRestart,
  onRemove,
}: {
  container: DockerContainer;
  pending: boolean;
  /** True when this row was opened via a deep link (e.g. the status bar popover); rings briefly. */
  focused?: boolean;
  rowRef?: (node: HTMLDivElement | null) => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onRemove: () => void;
}): React.JSX.Element {
  const running = container.state === 'running';
  const memPercent =
    container.memUsedBytes != null && container.memLimitBytes
      ? (container.memUsedBytes / container.memLimitBytes) * 100
      : null;
  const showUsage = running && (container.cpuPercent != null || memPercent != null);

  return (
    <div
      ref={rowRef}
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border bg-card/60 px-3 py-2.5 transition-shadow',
        focused && 'ring-2 ring-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]',
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <DockerIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <SimpleTooltip label={container.name}>
            <span className="truncate text-sm font-medium">{container.name}</span>
          </SimpleTooltip>
          <Badge
            variant={STATE_BADGE_VARIANT[container.state]}
            className="px-1.5 py-0 text-[10px] leading-4"
          >
            {STATE_LABEL[container.state]}
          </Badge>
          {container.composeProject && (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] leading-4">
              {container.composeProject}
            </Badge>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {container.image} · {container.status}
        </div>
        {showUsage && (
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-muted-foreground">
            {container.cpuPercent != null && (
              <span className="flex items-center gap-1.5">
                CPU
                <UsageBar percent={container.cpuPercent} />
                <span className="w-10 shrink-0 text-right tabular-nums">
                  {container.cpuPercent.toFixed(1)}%
                </span>
              </span>
            )}
            {memPercent != null && container.memUsedBytes != null && (
              <span className="flex items-center gap-1.5">
                Mem
                <UsageBar percent={memPercent} />
                <span className="w-14 shrink-0 text-right tabular-nums">
                  {formatMem(container.memUsedBytes)}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {running ? (
          <SimpleTooltip label="Stop">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={pending}
              aria-label={`Stop ${container.name}`}
              onClick={onStop}
            >
              <StopCircle className="h-3.5 w-3.5" />
            </Button>
          </SimpleTooltip>
        ) : (
          <SimpleTooltip label="Start">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={pending}
              aria-label={`Start ${container.name}`}
              onClick={onStart}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          </SimpleTooltip>
        )}
        <SimpleTooltip label="Restart">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={pending}
            aria-label={`Restart ${container.name}`}
            onClick={onRestart}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Remove">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            disabled={pending}
            aria-label={`Remove ${container.name}`}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
      </div>
    </div>
  );
}
