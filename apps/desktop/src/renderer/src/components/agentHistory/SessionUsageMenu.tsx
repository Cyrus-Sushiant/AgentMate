import type { AgentHistorySession, UsageTokens } from '@agentmat/core';
import type { AgentSessionUsage } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { CircleInfo, TriangleAlert } from '@/components/icons';
import {
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useChartColors } from '@/lib/chartColors';
import { queryKeys } from '@/lib/queryKeys';
import { formatCost, formatTokens } from '@/lib/usageFormat';
import { cn } from '@/lib/utils';
import { PROVIDER_LABEL } from './historyFilters';
import { shortModel } from './modelLabel';

type Usage = Extract<AgentSessionUsage, { status: 'ok' }>;

/** The four kinds of token, in the fixed order that gives each its chart color. */
const KINDS = [
  { key: 'input', label: 'Input' },
  { key: 'output', label: 'Output' },
  { key: 'cacheRead', label: 'Cache read' },
  { key: 'cacheWrite', label: 'Cache write' },
] as const satisfies readonly { key: keyof UsageTokens; label: string }[];

/** Models listed before the rest are folded into a count. */
const MAX_MODEL_ROWS = 5;

const exact = new Intl.NumberFormat();

/** A share of the total as a whole percent, keeping a sliver visible as "<1%". */
function share(part: number, total: number): string {
  if (total <= 0 || part <= 0) return '0%';
  const percent = (part / total) * 100;
  return percent < 1 ? '<1%' : `${Math.round(percent)}%`;
}

function Stat({
  label,
  value,
  note,
  muted,
}: {
  label: string;
  value: string;
  note?: string;
  muted?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[11px] leading-4 text-muted-foreground">{label}</p>
      <p
        className={cn(
          'truncate font-semibold leading-6',
          muted ? 'text-[14px] text-muted-foreground' : 'text-[20px]',
        )}
      >
        {value}
      </p>
      <p className="h-3 truncate text-[10px] leading-3 text-muted-foreground/80">{note}</p>
    </div>
  );
}

function Note({ children }: { children: string }): React.JSX.Element {
  return (
    <p className="flex gap-1.5 px-2.5 pb-1.5 pt-1 text-[10px] leading-snug text-muted-foreground">
      <CircleInfo className="mt-px h-2.5 w-2.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** One thin stacked bar of where the tokens went. The legend under it carries the numbers. */
function ShareBar({
  tokens,
  colors,
}: {
  tokens: UsageTokens;
  colors: string[];
}): React.JSX.Element {
  const parts = KINDS.flatMap((kind, i) =>
    tokens[kind.key] > 0 ? [{ ...kind, value: tokens[kind.key], color: colors[i] }] : [],
  );
  const summary = KINDS.map((k) => `${k.label} ${share(tokens[k.key], tokens.total)}`).join(', ');
  return (
    <div role="img" aria-label={`Token split: ${summary}`} className="mx-2.5 flex h-2 gap-[2px]">
      {parts.map((part, i) => (
        <span
          key={part.key}
          // Grown by value, with a floor so a sliver is still a visible mark.
          style={{ flex: `${part.value} 1 0`, backgroundColor: part.color }}
          className={cn(
            'h-full min-w-[3px] rounded-[2px]',
            i === 0 && 'rounded-l-full',
            i === parts.length - 1 && 'rounded-r-full',
          )}
        />
      ))}
    </div>
  );
}

function Legend({ tokens, colors }: { tokens: UsageTokens; colors: string[] }): React.JSX.Element {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[12px]">
      {KINDS.map((kind, i) => (
        <div
          key={kind.key}
          className="grid grid-cols-[auto_1fr_auto_2.25rem] items-center gap-x-2 py-[3px]"
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: colors[i] }}
          />
          <span className="text-muted-foreground">{kind.label}</span>
          <span className="tabular-nums">{formatTokens(tokens[kind.key])}</span>
          <span className="text-right text-[11px] tabular-nums text-muted-foreground">
            {share(tokens[kind.key], tokens.total)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Per model, for a conversation that switched models along the way. */
function Models({ models }: { models: Usage['models'] }): React.JSX.Element {
  const shown = models.slice(0, MAX_MODEL_ROWS);
  const hidden = models.length - shown.length;
  return (
    <>
      <ContextMenuSeparator />
      <ContextMenuLabel>Models</ContextMenuLabel>
      <div className="px-2.5 pb-1.5 text-[12px]">
        {shown.map((entry) => (
          <div
            key={entry.model}
            className="grid grid-cols-[1fr_auto_3.5rem] items-baseline gap-x-2 py-[3px]"
          >
            <span className="truncate">{shortModel(entry.model)}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatTokens(entry.tokens.total)}
            </span>
            <span
              className={cn(
                'text-right tabular-nums',
                entry.costUsd === null && 'text-[11px] text-muted-foreground',
              )}
            >
              {formatCost(entry.costUsd) ?? 'Unpriced'}
            </span>
          </div>
        ))}
        {hidden > 0 ? (
          <p className="pt-0.5 text-[11px] text-muted-foreground">{`and ${hidden} more`}</p>
        ) : null}
      </div>
    </>
  );
}

function Details({ usage }: { usage: Usage }): React.JSX.Element {
  const { categorical } = useChartColors();
  const { tokens } = usage;
  const priced = usage.costUsd !== null;
  const costText = priced
    ? `${formatCost(usage.costUsd)}${usage.costPartial ? '+' : ''}`
    : tokens.total === 0
      ? '$0.00'
      : 'Unpriced';

  return (
    <>
      <div className="flex gap-4 px-2.5 pb-1 pt-1">
        <Stat
          label="Tokens"
          value={formatTokens(tokens.total)}
          note={tokens.total >= 1000 ? exact.format(tokens.total) : undefined}
        />
        <div aria-hidden="true" className="my-0.5 w-px self-stretch bg-foreground/[0.08]" />
        <Stat
          label="Est. cost"
          value={costText}
          note={priced ? 'list price estimate' : undefined}
          muted={!priced && tokens.total > 0}
        />
      </div>
      {tokens.total > 0 ? (
        <>
          <ShareBar tokens={tokens} colors={categorical} />
          <Legend tokens={tokens} colors={categorical} />
        </>
      ) : (
        <Note>No tokens used yet.</Note>
      )}
      {usage.models.length > 1 ? <Models models={usage.models} /> : null}
      {!priced && tokens.total > 0 ? (
        <Note>
          {usage.models.length > 1
            ? 'No price is known for the models this ran on.'
            : 'No price is known for the model this ran on.'}
        </Note>
      ) : null}
      {usage.costPartial ? (
        <Note>Some models have no known price, so the cost is a minimum.</Note>
      ) : null}
    </>
  );
}

function Loading(): React.JSX.Element {
  return (
    <div className="space-y-3 px-2.5 py-2" aria-busy="true">
      <div className="flex gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="flex-1 space-y-1.5">
            <Skeleton className="h-2.5 w-10 rounded" />
            <Skeleton className="h-5 w-16 rounded" />
          </div>
        ))}
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-3 w-full rounded" />
        ))}
      </div>
    </div>
  );
}

function Unavailable({
  icon: Icon,
  children,
}: {
  icon: typeof CircleInfo;
  children: string;
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 px-2.5 py-2 text-[12px] leading-snug text-muted-foreground">
      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function UsageBody({ session }: { session: AgentHistorySession }): React.JSX.Element {
  const usage = useQuery({
    queryKey: queryKeys.agentSessionUsage(session.provider, session.id),
    queryFn: () => window.agentmat.agents.sessionUsage(session.provider, session.id),
    // A running conversation keeps adding to it, so a second look a little later is fresh.
    staleTime: 15_000,
    meta: { silentLoading: true },
  });

  if (usage.isPending) return <Loading />;
  const data = usage.data;
  if (usage.isError || !data || data.status === 'unavailable') {
    return (
      <Unavailable icon={TriangleAlert}>
        The log for this conversation could not be read.
      </Unavailable>
    );
  }
  if (data.status === 'unsupported') {
    return (
      <Unavailable icon={CircleInfo}>
        {`${PROVIDER_LABEL[session.provider]} does not record token usage.`}
      </Unavailable>
    );
  }
  return <Details usage={data} />;
}

/** The right-click menu of a history row: what the conversation used so far. */
export function SessionUsageMenu({ session }: { session: AgentHistorySession }): React.JSX.Element {
  return (
    <ContextMenuContent className="w-[17.5rem]" aria-label="Token usage">
      <ContextMenuLabel>Token usage</ContextMenuLabel>
      <UsageBody session={session} />
    </ContextMenuContent>
  );
}
