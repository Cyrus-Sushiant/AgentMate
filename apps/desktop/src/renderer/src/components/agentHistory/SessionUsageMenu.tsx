import type { AgentHistorySession } from '@agentmat/core';
import type { AgentSessionUsage } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { ContextMenuContent, ContextMenuLabel } from '@/components/ui/context-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import { formatCost, formatTokens } from '@/lib/usageFormat';
import { cn } from '@/lib/utils';
import { PROVIDER_LABEL } from './historyFilters';

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-6 px-2.5 py-0.5 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums', strong && 'font-medium')}>{value}</span>
    </div>
  );
}

function Note({ children }: { children: string }): React.JSX.Element {
  return (
    <p className="px-2.5 pb-0.5 pt-1 text-[10px] leading-snug text-muted-foreground">{children}</p>
  );
}

function costText(usage: Extract<AgentSessionUsage, { status: 'ok' }>): string {
  if (usage.costUsd === null) return usage.tokens.total === 0 ? '$0.00' : 'Not priced';
  // A lower bound gets a plus, since part of the run ran on a model with no known price.
  return `${formatCost(usage.costUsd)}${usage.costPartial ? '+' : ''}`;
}

function UsageBody({ session }: { session: AgentHistorySession }): React.JSX.Element {
  const usage = useQuery({
    queryKey: queryKeys.agentSessionUsage(session.provider, session.id),
    queryFn: () => window.agentmat.agents.sessionUsage(session.provider, session.id),
    // A running conversation keeps adding to it, so a second look a little later is fresh.
    staleTime: 15_000,
    meta: { silentLoading: true },
  });

  if (usage.isPending) {
    return (
      <div className="space-y-1.5 px-2.5 py-1.5" aria-busy="true">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-2/3 rounded" />
      </div>
    );
  }
  const data = usage.data;
  if (usage.isError || !data || data.status === 'unavailable') {
    return <Note>The log for this conversation could not be read.</Note>;
  }
  if (data.status === 'unsupported') {
    return <Note>{`${PROVIDER_LABEL[session.provider]} does not record token usage.`}</Note>;
  }

  const { tokens } = data;
  return (
    <>
      <Row label="Tokens" value={formatTokens(tokens.total)} strong />
      <Row label="Est. cost" value={costText(data)} strong />
      <div className="mx-2.5 my-1 h-px bg-foreground/[0.08]" />
      <Row label="Input" value={formatTokens(tokens.input)} />
      <Row label="Output" value={formatTokens(tokens.output)} />
      <Row label="Cache read" value={formatTokens(tokens.cacheRead)} />
      <Row label="Cache write" value={formatTokens(tokens.cacheWrite)} />
      {data.costUsd === null && tokens.total > 0 ? (
        <Note>No price is known for the model this ran on.</Note>
      ) : null}
      {data.costPartial ? (
        <Note>Some models have no known price, so the cost is a minimum.</Note>
      ) : null}
    </>
  );
}

/** The right-click menu of a history row: what the conversation used so far. */
export function SessionUsageMenu({ session }: { session: AgentHistorySession }): React.JSX.Element {
  return (
    <ContextMenuContent className="min-w-[14rem]" aria-label="Token usage">
      <ContextMenuLabel>Token usage</ContextMenuLabel>
      <UsageBody session={session} />
    </ContextMenuContent>
  );
}
