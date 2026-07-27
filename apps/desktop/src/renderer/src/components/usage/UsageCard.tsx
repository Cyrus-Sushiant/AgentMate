import type {
  ProviderUsage,
  SubscriptionUsage,
  SubscriptionWindow,
  UsageProviderDefinition,
  UsageSegment,
  WidgetMode,
  WidgetStyle,
} from '@agentmat/core';
import { ProviderLogo } from '@/components/providerLogos';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { SparklineChart } from '@/components/dashboard/SparklineChart';
import {
  formatCost,
  formatCountdown,
  formatPercent,
  formatReset,
  formatTokens,
} from '@/lib/usageFormat';

export interface UsageCardBodyProps {
  usage: ProviderUsage;
  def: UsageProviderDefinition;
  /** 'mono' tints everything with the foreground color; 'colorful' uses the brand accent. */
  style?: WidgetStyle;
  /** Compact drops the sparkline + secondary stats (small widget). */
  compact?: boolean;
  /** Hide the logo + name row when the host already renders the title (Usage page). */
  hideHeader?: boolean;
  /** Which of the two widgets this is. Defaults to the original tokens view. */
  mode?: WidgetMode;
}

/**
 * The card body's shape while the scan is still running: the headline number,
 * a limit bar and the sparkline's row, all in their final positions so the card
 * doesn't jump when the real figures arrive. Each card shows this on its own —
 * providers land one at a time, and the ones already in never go blank.
 */
export function UsageCardBodySkeleton({
  compact = false,
}: {
  compact?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="ml-auto h-4 w-12" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      {!compact && <Skeleton className="mt-auto h-11 w-full" />}
    </div>
  );
}

/** Subscription limits are only worth showing when the account actually has them. */
export function hasSubscriptionView(usage: ProviderUsage): boolean {
  const sub = usage.subscription;
  return !!sub && sub.mode === 'subscription' && Array.isArray(sub.windows) && sub.windows.length > 0;
}

/**
 * The inner content of a Token Usage card. Renders whichever of the two widgets
 * `mode` asks for: the original token view (tokens + cost + burn-rate
 * sparkline), or the subscription view (the plan's rolling limits and their
 * reset countdowns). The token view is the default and is deliberately
 * untouched by the subscription feature — right down to the header, which only
 * grows a plan badge in subscription mode.
 */
export function UsageCardBody({
  usage,
  def,
  style = 'colorful',
  compact = false,
  hideHeader = false,
  mode = 'tokens',
}: UsageCardBodyProps): React.JSX.Element {
  const accent = style === 'colorful' ? def.accentColor : 'hsl(var(--foreground))';
  const subscription = usage.subscription;
  // The plan badge is account identity, not a limits readout, so it shows in
  // both widgets whenever the account is known — the token view of a Pro
  // account should still say Pro.
  const plan = subscription?.plan ?? null;

  const header = hideHeader ? null : (
    <div className="flex items-center gap-2">
      <ProviderLogo providerId={def.id} className="h-5 w-5" />
      <span className="truncate text-sm font-semibold">{def.name}</span>
      {plan && (
        <span
          className="ml-auto shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium leading-4"
          style={{ borderColor: `${accent}66`, color: accent }}
        >
          {plan.label}
        </span>
      )}
    </div>
  );

  if (usage.status === 'connect') {
    return (
      <div className="flex h-full flex-col gap-2">
        {header}
        <p className="text-xs text-muted-foreground">
          {def.dataSource === 'api-key'
            ? `${def.keyHint ?? 'API key'} required to track usage.`
            : def.dataSource === 'local-session'
              ? `Sign in to the ${def.name} app to track usage.`
              : 'Integration coming soon.'}
        </p>
      </div>
    );
  }

  if (usage.status === 'error') {
    return (
      <div className="flex h-full flex-col gap-2">
        {header}
        <SimpleTooltip label={usage.error}>
          <p className="truncate text-xs text-destructive">
            {usage.error ?? 'Failed to load usage.'}
          </p>
        </SimpleTooltip>
      </div>
    );
  }

  // 'subscription' is a request, not a guarantee — an API-billed account has no
  // limits to draw, so it falls back to tokens rather than rendering an empty card.
  if (mode === 'subscription' && hasSubscriptionView(usage) && subscription) {
    return (
      <SubscriptionBody
        subscription={subscription}
        usage={usage}
        accent={accent}
        compact={compact}
        header={header}
      />
    );
  }

  const todayTokens = usage.today.tokens.total;
  const period = todayTokens > 0 ? usage.today : usage.last30d;
  const primaryTokens = period.tokens.total;
  const primaryLabel = todayTokens > 0 ? 'today' : 'last 30d';
  const cost = formatCost(usage.today.costUsd ?? usage.last30d.costUsd);
  // Segments partition the period the headline number came from, so the rows
  // below always add up to it. Empty slices are dropped rather than shown as 0.
  const segments = (period.segments ?? []).filter(
    (s) => s.tokens.total > 0 || (s.requests ?? 0) > 0,
  );
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

      {segments.length > 0 && (
        <SegmentBreakdown segments={segments} total={primaryTokens} accent={accent} />
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

/** Shades of the one accent, so a split reads as one provider's usage. */
function segmentOpacity(index: number): number {
  return [1, 0.55, 0.3, 0.18][index] ?? 0.18;
}

/**
 * How one period splits across named slices — Cursor's Auto mode versus what it
 * billed at API rates. A stacked share bar carries the ratio at a glance (the
 * part that still works at widget size), and a row per slice gives the tokens,
 * cost and request count behind it.
 */
function SegmentBreakdown({
  segments,
  total,
  accent,
}: {
  segments: UsageSegment[];
  total: number;
  accent: string;
}): React.JSX.Element {
  // The bar is a ratio of the slices themselves — falling back to the period
  // total would leave a phantom gap when a slice has requests but no tokens.
  const barTotal = segments.reduce((sum, s) => sum + s.tokens.total, 0) || total;

  return (
    <div className="space-y-1">
      {barTotal > 0 && (
        <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-foreground/10">
          {segments.map((segment, i) => (
            <div
              key={segment.key}
              style={{
                width: `${(segment.tokens.total / barTotal) * 100}%`,
                backgroundColor: accent,
                opacity: segmentOpacity(i),
              }}
            />
          ))}
        </div>
      )}
      {segments.map((segment, i) => {
        const segmentCost = formatCost(segment.costUsd);
        return (
          <div key={segment.key} className="flex items-baseline gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: accent, opacity: segmentOpacity(i) }}
              />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="ml-auto shrink-0 tabular-nums">
              {formatTokens(segment.tokens.total)}
            </span>
            {segmentCost && (
              <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                {segmentCost}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Plan name, one bar per rolling limit, and what it cost so far today. */
function SubscriptionBody({
  subscription,
  usage,
  accent,
  compact,
  header,
}: {
  subscription: SubscriptionUsage;
  usage: ProviderUsage;
  accent: string;
  compact: boolean;
  header: React.ReactNode;
}): React.JSX.Element {
  const estimated = subscription.source === 'estimate';
  const cost = formatCost(usage.today.costUsd);

  return (
    <div className="flex h-full flex-col gap-2">
      {header}

      <div className="flex flex-col gap-2">
        {subscription.windows.map((window) => (
          <LimitBar key={window.key} window={window} accent={accent} estimated={estimated} />
        ))}
      </div>

      {!compact && (
        <div className="mt-auto flex items-baseline gap-2 pt-1 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{formatTokens(usage.today.tokens.total)} tokens today</span>
          {cost && <span className="tabular-nums">· {cost} equivalent</span>}
          {estimated && (
            <SimpleTooltip
              label={`Estimated from local logs — ${subscription.estimateReason ?? 'account unreachable'}.`}
            >
              <span className="ml-auto shrink-0">estimated</span>
            </SimpleTooltip>
          )}
        </div>
      )}
    </div>
  );
}

/** One rolling limit: name, share consumed, countdown, and a fill bar. */
function LimitBar({
  window,
  accent,
  estimated,
}: {
  window: SubscriptionWindow;
  accent: string;
  estimated: boolean;
}): React.JSX.Element {
  const countdown = formatCountdown(window.resetAt);
  // Near the cap the brand accent stops being the useful signal.
  const color = window.percent >= 90 ? 'hsl(var(--destructive))' : accent;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2 text-[11px]">
        <span className="truncate text-muted-foreground">{window.label}</span>
        <span className="font-medium tabular-nums" style={{ color }}>
          {estimated ? '~' : ''}
          {formatPercent(window.percent)}
        </span>
        {countdown && (
          <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
            resets in {countdown}
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${window.percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
