import type { ProjectUsageReport } from '@shared/apiTypes';
import { PROVIDER_LABEL } from '@/components/agentHistory/historyFilters';
import { shortModel } from '@/components/agentHistory/modelLabel';
import { CliLogo } from '@/components/cliLogos';
import { ChartSimple, Cpu, History, Robot } from '@/components/icons';
import { SectionCard } from '@/components/projects/ProjectDetailChrome';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { TokenLegend, TokenShareBar } from '@/components/usage/TokenSplit';
import { useChartColors } from '@/lib/chartColors';
import { timeAgo } from '@/lib/time';
import { formatTokens } from '@/lib/usageFormat';
import { cn } from '@/lib/utils';
import { HISTORY_CLI_ID } from '@/lib/workspace/launch';
import { formatMoney } from './formatMoney';

type Report = Extract<ProjectUsageReport, { status: 'ok' }>;

/** A bar with a value is never thinner than this, so a small share is still a visible mark. */
const MIN_BAR_PERCENT = 4;

interface BarRow {
  key: string;
  label: string;
  /** Shown on hover, when the label is a shortened name. */
  hint?: string;
  icon?: React.ReactNode;
  tokens: number;
  costUsd: number | null;
}

/**
 * Rows with a bar behind each figure. The bars show cost when any row has one, so the list reads
 * as where the money went; a row with no known price gets a faint stub instead of a false zero.
 */
function BarList({ label, rows }: { label: string; rows: BarRow[] }): React.JSX.Element {
  const byCost = rows.some((row) => (row.costUsd ?? 0) > 0);
  const value = (row: BarRow): number => (byCost ? (row.costUsd ?? 0) : row.tokens);
  // No floor on the scale: a project that spent under a dollar still fills its biggest bar.
  const max = Math.max(0, ...rows.map(value));

  return (
    <ul aria-label={label} className="space-y-0.5">
      {rows.map((row) => {
        const cost = formatMoney(row.costUsd);
        const width =
          max > 0 && value(row) > 0 ? Math.max(MIN_BAR_PERCENT, (value(row) / max) * 100) : 0;
        const name = (
          <span className="flex min-w-0 items-center gap-1.5 text-[12px]">
            {row.icon}
            <span className="truncate">{row.label}</span>
          </span>
        );
        return (
          <li
            key={row.key}
            className="grid grid-cols-[minmax(0,8.5rem)_minmax(2rem,1fr)_auto] items-center gap-x-3 py-1.5"
          >
            {row.hint ? <SimpleTooltip label={row.hint}>{name}</SimpleTooltip> : name}
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                data-testid="bar-fill"
                className={cn(
                  'h-full rounded-full',
                  byCost && row.costUsd === null ? 'bg-foreground/25' : 'bar-shine bg-primary',
                )}
                style={{ width: `${byCost && row.costUsd === null ? MIN_BAR_PERCENT : width}%` }}
              />
            </div>
            <span className="text-right text-[12px] tabular-nums">
              {cost ? (
                <span className="font-medium">{cost}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">Unpriced</span>
              )}
              <span className="text-muted-foreground"> · {formatTokens(row.tokens)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AgentCard({ report }: { report: Report }): React.JSX.Element {
  const rows = report.byAgent.map(
    (agent): BarRow => ({
      key: agent.provider,
      label: PROVIDER_LABEL[agent.provider],
      icon: <CliLogo cliId={HISTORY_CLI_ID[agent.provider]} className="h-3.5 w-3.5" />,
      tokens: agent.tokens.total,
      costUsd: agent.costUsd,
    }),
  );
  return (
    <SectionCard icon={Robot} title="By agent" description="Which CLI the spend came from.">
      <BarList label="Spend by agent" rows={rows} />
    </SectionCard>
  );
}

function ModelCard({ report }: { report: Report }): React.JSX.Element {
  const rows = report.byModel.map(
    (entry): BarRow => ({
      key: entry.model,
      label: shortModel(entry.model),
      hint: entry.model,
      tokens: entry.tokens.total,
      costUsd: entry.costUsd,
    }),
  );
  return (
    <SectionCard icon={Cpu} title="By model" description="Priced model by model, cache included.">
      <BarList label="Spend by model" rows={rows} />
    </SectionCard>
  );
}

function MixCard({ report }: { report: Report }): React.JSX.Element {
  const { categorical } = useChartColors();
  return (
    <SectionCard icon={ChartSimple} title="Token mix" description="Where the tokens went.">
      <TokenShareBar tokens={report.tokens} colors={categorical} />
      <TokenLegend tokens={report.tokens} colors={categorical} className="pt-2.5" />
    </SectionCard>
  );
}

function TopCard({ report }: { report: Report }): React.JSX.Element {
  return (
    <SectionCard
      icon={History}
      title="Most expensive conversations"
      description="Where a single conversation ran up the bill."
    >
      {/* Runs edge to edge, with hairlines between rows, like the lists on the other sections. */}
      <ol
        aria-label="Most expensive conversations"
        className="settings-rows -mx-4 -mb-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]"
      >
        {report.top.map((conversation, i) => {
          const cost = formatMoney(conversation.costUsd);
          return (
            <li
              key={`${conversation.provider}:${conversation.id}`}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="w-4 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <CliLogo
                cliId={HISTORY_CLI_ID[conversation.provider]}
                className="h-3.5 w-3.5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{conversation.title ?? 'Untitled conversation'}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {PROVIDER_LABEL[conversation.provider]}
                  {conversation.updatedAt > 0
                    ? ` · ${timeAgo(new Date(conversation.updatedAt).toISOString())}`
                    : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums">
                  {cost ? (
                    `${cost}${conversation.costPartial ? '+' : ''}`
                  ) : (
                    <span className="text-[11px] font-normal text-muted-foreground">Unpriced</span>
                  )}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {formatTokens(conversation.tokens)} tokens
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}

/** Everything under the headline: who spent it, on what, and which conversations stand out. */
export function UsageBreakdowns({ report }: { report: Report }): React.JSX.Element {
  return (
    <>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <AgentCard report={report} />
        <ModelCard report={report} />
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <MixCard report={report} />
        <TopCard report={report} />
      </div>
    </>
  );
}
