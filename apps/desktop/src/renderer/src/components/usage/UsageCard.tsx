import type {
  ProviderUsage,
  SubscriptionUsage,
  SubscriptionWindow,
  UsageProviderDefinition,
  WidgetMode,
  WidgetStyle,
} from '@agentmat/core';
import { ProviderLogo } from '@/components/providerLogos';
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

/** Subscription limits are only worth showing when the account actually has them. */
export function hasSubscriptionView(usage: ProviderUsage): boolean {
  const sub = usage.subscription;
  return !!sub && sub.mode === 'subscription' && sub.windows.length > 0;
}

/**
 * The inner content of a Token Usage card. Renders one of two views: the token
 * view (tokens + cost + burn-rate sparkline), or — for accounts billed by
 * subscription rather than by API key — the plan's rolling limits with their
 * reset countdowns, which is what actually constrains those users.
 */
export function UsageCardBody({
  usage,
  def,
  style = 'colorful',
  compact = false,
  hideHeader = false,
  mode = 'auto',
}: UsageCardBodyProps): React.JSX.Element {
  const accent = style === 'colorful' ? def.accentColor : 'hsl(var(--foreground))';
  const subscription = usage.subscription;
  const plan = subscription?.plan;

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
  if (mode !== 'tokens' && hasSubscriptionView(usage) && subscription) {
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
