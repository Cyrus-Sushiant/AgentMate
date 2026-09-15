import type { AgentStatus } from '@agentmat/core';
import { cn } from '@/lib/utils';

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  working: 'Working',
  'needs-input': 'Needs your input',
  done: 'Finished',
  idle: 'Idle',
  exited: 'Exited',
};

/**
 * A small mark for what an agent is doing: a spinning ring while it works, a pulsing amber
 * dot when it waits on you, a solid green dot when it finished and you have not looked yet.
 * Idle and exited show nothing.
 */
export function AgentStatusDot({
  status,
  className,
}: {
  status: AgentStatus | null;
  className?: string;
}): React.JSX.Element | null {
  if (status === 'working') {
    return (
      <span
        role="img"
        aria-label={AGENT_STATUS_LABEL.working}
        className={cn(
          'block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary shadow-[0_0_6px_hsl(var(--primary)/0.45)] motion-reduce:animate-none motion-reduce:border-primary',
          className,
        )}
      />
    );
  }
  if (status === 'needs-input') {
    return (
      <span
        role="img"
        aria-label={AGENT_STATUS_LABEL['needs-input']}
        className={cn('relative flex h-2 w-2 shrink-0', className)}
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-warning shadow-[0_0_6px_hsl(var(--warning))]" />
      </span>
    );
  }
  if (status === 'done') {
    return (
      <span
        role="img"
        aria-label={AGENT_STATUS_LABEL.done}
        className={cn(
          'block h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]',
          className,
        )}
      />
    );
  }
  return null;
}
