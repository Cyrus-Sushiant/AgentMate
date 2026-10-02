import type { ContainerSummary } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import {
  CircleCheck,
  CircleX,
  Pause,
  Spinner,
  StopCircle,
  TriangleAlert,
} from '@/components/icons';
import { HEALTH_LABEL, STATE_LABEL, stateTone } from '@/lib/deploy/containers/list';
import { cn } from '@/lib/utils';

/**
 * A container's state in words with its own mark (E06 T8), never by colour alone: running,
 * running but unhealthy, paused, restarting, exited and the rest.
 */

const TONE_CLASS = {
  good: 'border-success/30 bg-success/10 text-success',
  busy: 'border-warning/30 bg-warning/10 text-warning',
  idle: 'border-border bg-secondary/50 text-muted-foreground',
  bad: 'border-destructive/30 bg-destructive/10 text-destructive',
} as const;

export function StateChip({
  container,
  className,
}: {
  container: Pick<ContainerSummary, 'state' | 'health'>;
  className?: string;
}): React.JSX.Element {
  const tone = stateTone(container);
  const health = container.state === 'running' ? HEALTH_LABEL[container.health] : null;
  const Icon =
    tone === 'good'
      ? CircleCheck
      : tone === 'bad'
        ? container.state === 'dead'
          ? CircleX
          : TriangleAlert
        : tone === 'busy'
          ? Spinner
          : container.state === 'paused'
            ? Pause
            : StopCircle;
  const label =
    health && health !== 'Healthy'
      ? `${STATE_LABEL[container.state]}, ${health.toLowerCase()}`
      : STATE_LABEL[container.state];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        TONE_CLASS[tone],
        className,
      )}
      data-state={container.state}
    >
      <Icon className={cn('h-3 w-3', tone === 'busy' && 'motion-safe:animate-spin')} />
      <span className="text-foreground">{label}</span>
    </span>
  );
}
