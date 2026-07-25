// Shared types for the Token Usage feature (CodexBar-style). These describe the
// provider catalog, the normalized usage snapshot every data source returns, and
// the desktop-widget instances the user pins to their screen.

/** How AgentMate obtains usage data for a provider. */
export type UsageDataSource =
  | 'local-log' // parse local CLI logs on disk (no credentials) — Claude Code, Codex
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
export type SubscriptionWindowKey = 'session' | 'week' | 'week-opus';

/** One rolling rate-limit window on a subscription plan. */
export interface SubscriptionWindow {
  key: SubscriptionWindowKey;
  /** Display label — 'Session (5h)', 'Weekly', 'Weekly (Opus)'. */
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

/** Per-provider user configuration (enabled + optional API key). */
export interface UsageProviderConfig {
  enabled: boolean;
  apiKey?: string | null;
  /** Optional base URL override for self-hosted gateways (LiteLLM, LLM Proxy…). */
  baseUrl?: string | null;
}
