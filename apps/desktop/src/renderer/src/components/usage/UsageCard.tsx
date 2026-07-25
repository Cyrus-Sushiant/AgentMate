import type { ProviderUsage, UsageProviderDefinition, WidgetStyle } from '@agentmat/core';
import { ProviderLogo } from '@/components/providerLogos';
import { SparklineChart } from '@/components/dashboard/SparklineChart';
import { formatCost, formatPercent, formatReset, formatTokens } from '@/lib/usageFormat';

export interface UsageCardBodyProps {
  usage: ProviderUsage;
  def: UsageProviderDefinition;
  /** 'mono' tints everything with the foreground color; 'colorful' uses the brand accent. */
  style?: WidgetStyle;
  /** Compact drops the sparkline + secondary stats (small widget). */
  compact?: boolean;
}

/**
 * The inner content of a Token Usage card — logo, headline tokens + cost, quota
 * bar with reset countdown, and a burn-rate sparkline. Shared by the in-app
 * Usage page and the floating desktop widget so both look identical.
 */
export function UsageCardBody({
  usage,
  def,
  style = 'colorful',
  compact = false,
}: UsageCardBodyProps): React.JSX.Element {
  const accent = style === 'colorful' ? def.accentColor : 'hsl(var(--foreground))';

  const header = (
    <div className="flex items-center gap-2">
      <ProviderLogo providerId={def.id} className="h-5 w-5" />
      <span className="truncate text-sm font-semibold">{def.name}</span>
    </div>
  );

  if (usage.status === 'connect') {
    return (
      <div className="flex h-full flex-col gap-2">
        {header}
        <p className="text-xs text-muted-foreground">
          {def.dataSource === 'api-key'
            ? 'Add an API key to track usage.'
            : 'Integration coming soon.'}
        </p>
      </div>
    );
  }

  if (usage.status === 'error') {
    return (
      <div className="flex h-full flex-col gap-2">
        {header}
        <p className="truncate text-xs text-destructive" title={usage.error}>
          {usage.error ?? 'Failed to load usage.'}
        </p>
      </div>
    );
  }

  const todayTokens = usage.today.tokens.total;
  const primaryTokens = todayTokens > 0 ? todayTokens : usage.last30d.tokens.total;
  const primaryLabel = todayTokens > 0 ? 'today' : 'last 30d';
  const cost = formatCost(usage.today.costUsd ?? usage.last30d.costUsd);
  const series = usage.series ?? [];
  const window = usage.window;
  const reset = formatReset(window?.resetAt);

  return (
    <div className="flex h-full flex-col gap-2">
      {header}

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{formatTokens(primaryTokens)}</span>
        <span className="text-[11px] text-muted-foreground">tokens {primaryLabel}</span>
        {cost && (
          <span className="ml-auto text-sm font-medium tabular-nums" style={{ color: accent }}>
            {cost}
          </span>
        )}
      </div>

      {window && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {window.label} {formatPercent(window.percent)}
            </span>
            {reset && <span>{reset}</span>}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${window.percent}%`, backgroundColor: accent }}
            />
          </div>
        </div>
      )}

      {!compact && series.length > 1 && (
        <div className="mt-auto">
          <SparklineChart
            height={44}
            timestamps={series.map((_, i) => i)}
            domainMin={0}
            formatValue={formatTokens}
            series={[{ key: def.id, label: def.name, color: accent, values: series }]}
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
            <span>7d {formatTokens(usage.last7d.tokens.total)}</span>
            <span>30d {formatTokens(usage.last30d.tokens.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
