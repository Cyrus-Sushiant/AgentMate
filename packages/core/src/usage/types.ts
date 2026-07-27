// Shared types for the Token Usage feature (CodexBar-style). These describe the
// provider catalog, the normalized usage snapshot every data source returns, and
// the desktop-widget instances the user pins to their screen.

/** How AgentMate obtains usage data for a provider. */
export type UsageDataSource =
  | 'local-log' // parse local CLI logs on disk (no credentials) — Claude Code, Codex
  | 'local-session' // reuse the vendor app's own signed-in session on disk — Cursor
  | 'api-key' // call the provider's usage/billing API with a stored key
  | 'unsupported'; // registered for completeness; live wiring not implemented yet

/** Loose grouping used only to organize the provider picker UI. */
export type UsageProviderCategory =
  | 'coding-agent'
  | 'api-provider'
  | 'ide'
  | 'router'
  | 'cloud'
  | 'audio'
  | 'other';

export interface UsageProviderDefinition {
  /** Stable kebab-case id, also the settings/widget key. */
  id: string;
  name: string;
  category: UsageProviderCategory;
  dataSource: UsageDataSource;
  /** True when the data source can attribute a $ cost (needs a pricing contract). */
  supportsCost: boolean;
  /** Marketing/site link, shown on the "Connect" state. */
  homepageUrl?: string;
  /** What kind of key the provider wants, when "API key" is too vague. */
  keyHint?: string;
  /** Brand accent used by the monogram logo fallback and the Colorful widget style. */
  accentColor: string;
}

export interface UsageTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Grand total across all token kinds. */
  total: number;
}

export function emptyUsageTokens(): UsageTokens {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
}

/** A rolling quota window (e.g. weekly limit) when the provider exposes one. */
export interface UsageWindow {
  label: string;
  used: number;
  total: number;
  /** 0–100. */
  percent: number;
  /** ISO datetime the window resets, when known. */
  resetAt: string | null;
}

/**
 * A named slice of one period's consumption — Cursor's Auto-mode vs API usage,
 * for example. Segments are a partition: they sum to the period they hang off,
 * so a card can show the split without a second fetch or a second period.
 */
export interface UsageSegment {
  /** Stable id within the provider ('auto', 'api'). */
  key: string;
  /** Display label — 'Auto', 'API'. */
  label: string;
  tokens: UsageTokens;
  /** Cost attributed to this slice, or null when the source can't price it. */
  costUsd: number | null;
  /** Request count, for sources that bill per request rather than per token. */
  requests?: number;
}

/** Per-period tokens + cost, keyed today / last 7d / last 30d. */
export interface UsagePeriod {
  tokens: UsageTokens;
  /** Estimated cost in `currency`, or null when it can't be priced. */
  costUsd: number | null;
  /** Optional breakdown of this period; omitted when the provider has no split. */
  segments?: UsageSegment[];
}

// --- Subscription (non-API) accounts --------------------------------------

/** How the account pays for inference. Drives which widget mode makes sense. */
export type UsageAccountMode = 'subscription' | 'api';

/** The plan a subscription account is on. */
export interface SubscriptionPlan {
  /** Raw id as the CLI records it ('pro', 'max', 'team'…). */
  id: string;
  /** Display label — 'Pro', 'Max 5×', 'Team'. */
  label: string;
}

/** Which rate-limit window a `SubscriptionWindow` describes. */
export type SubscriptionWindowKey = 'session' | 'week' | 'week-fable' | 'month';

/** Label for the weekly bucket that meters Fable on top of the shared one. */
export const FABLE_WEEK_LABEL = 'Weekly (Fable)';

/**
 * True when the plan meters Fable in its own weekly window, on top of the
 * weekly limit every subscription has. Only plans above Pro do — Pro gets a
 * single weekly limit, so the second bar would be an empty row.
 *
 * Matched by id rather than an exhaustive list so a new Max tier (or a seat
 * tier we haven't seen) still gets the window instead of silently losing it.
 */
export function metersFableWeekly(plan: SubscriptionPlan | null | undefined): boolean {
  const id = plan?.id.trim().toLowerCase();
  if (!id) return false;
  return id.startsWith('max') || id === 'team' || id === 'enterprise';
}

/** One rolling rate-limit window on a subscription plan. */
export interface SubscriptionWindow {
  key: SubscriptionWindowKey;
  /** Display label — 'Session (5h)', 'Weekly', 'Weekly (Fable)'. */
  label: string;
  /** 0–100 consumed. */
  percent: number;
  /** ISO datetime the window resets, when known. */
  resetAt: string | null;
  /** Tokens spent in the window — only set when derived from local logs. */
  usedTokens?: number;
  /** API-equivalent value of those tokens, which is what the percent is based on. */
  usedUsd?: number;
}

/**
 * Subscription state for a provider: which plan, and how much of each rolling
 * limit is spent. `source` says whether the numbers are authoritative
 * (fetched from the account) or reconstructed from local logs.
 */
export interface SubscriptionUsage {
  mode: UsageAccountMode;
  /** Null when the plan can't be determined (API mode, or not signed in). */
  plan: SubscriptionPlan | null;
  windows: SubscriptionWindow[];
  source: 'account' | 'estimate';
  /** Why the authoritative fetch was skipped/failed, for the estimate footnote. */
  estimateReason?: string;
}

export type ProviderUsageStatus = 'ok' | 'connect' | 'error';

/** Normalized snapshot returned by every data source, rendered by one card. */
export interface ProviderUsage {
  providerId: string;
  status: ProviderUsageStatus;
  /** Present when status === 'error'. */
  error?: string;
  today: UsagePeriod;
  last7d: UsagePeriod;
  last30d: UsagePeriod;
  /** Optional quota window (limit bar + reset countdown). */
  window?: UsageWindow;
  /** Plan + rolling-limit state, when the provider is on a subscription. */
  subscription?: SubscriptionUsage;
  /** Recent per-hour (or per-day) token totals for the burn-rate sparkline. */
  series?: number[];
  /** Currency code for the cost figures (only 'USD' for now). */
  currency: string;
  /** ISO datetime this snapshot was computed. */
  updatedAt: string;
}

export type WidgetSize = 'small' | 'medium' | 'large';
export type WidgetStyle = 'mono' | 'colorful';

/**
 * What a widget shows. These are two separate widgets a user can pin side by
 * side, not two states of one: 'tokens' is the original tokens/cost card, and
 * 'subscription' is the plan's rolling limits. Never infer one from the other —
 * a pinned widget keeps showing what it was pinned to show.
 */
export type WidgetMode = 'tokens' | 'subscription';

/** A floating desktop widget the user has pinned; persisted in AppSettings. */
export interface DesktopWidgetInstance {
  id: string;
  providerId: string;
  x: number;
  y: number;
  size: WidgetSize;
  style: WidgetStyle;
  /** Absent on widgets pinned before modes existed — those are token widgets. */
  mode?: WidgetMode;
}

// --- Rate-limit reset alerts ----------------------------------------------

/**
 * Telegram announcements fired when a subscription window rolls over. The
 * schedule isn't user-authored: a window's reset moment is already known from
 * `SubscriptionWindow.resetAt`, so all the user picks is which of those moments
 * are worth a message.
 */
export interface UsageResetAlertSettings {
  enabled: boolean;
  /** Provider whose windows are watched. Only Claude Code reports them today. */
  providerId: string;
  /** Windows to announce; a window missing from the account's plan is skipped. */
  windows: SubscriptionWindowKey[];
  /**
   * Chat/group the reset message goes to. Null reuses the notification chat
   * configured in Settings, which is what most users want.
   */
  chatId: string | null;
}

export function defaultUsageResetAlerts(): UsageResetAlertSettings {
  return { enabled: false, providerId: 'claude-code', windows: ['session'], chatId: null };
}

/**
 * A reset-alert block that is safe to read fields off. settings.json is written
 * by whichever build ran last (and can be hand-edited), so a saved block may be
 * missing pieces this one dereferences without asking — `windows` above all,
 * which is filtered and mapped on sight. Anything unusable falls back to the
 * default rather than reaching the UI as `undefined`.
 */
export function normalizeUsageResetAlerts(
  alerts: Partial<UsageResetAlertSettings> | null | undefined,
): UsageResetAlertSettings {
  const defaults = defaultUsageResetAlerts();
  if (!alerts || typeof alerts !== 'object') return defaults;
  return {
    enabled: alerts.enabled === true,
    providerId: alerts.providerId || defaults.providerId,
    windows: Array.isArray(alerts.windows) ? alerts.windows : defaults.windows,
    chatId: alerts.chatId ?? null,
  };
}

/** Per-provider user configuration (enabled + optional API key). */
export interface UsageProviderConfig {
  enabled: boolean;
  apiKey?: string | null;
  /** Optional base URL override for self-hosted gateways (LiteLLM, LLM Proxy…). */
  baseUrl?: string | null;
}
