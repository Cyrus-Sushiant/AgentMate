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

/** Per-period tokens + cost, keyed today / last 7d / last 30d. */
export interface UsagePeriod {
  tokens: UsageTokens;
  /** Estimated cost in `currency`, or null when it can't be priced. */
  costUsd: number | null;
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
  /** Recent per-hour (or per-day) token totals for the burn-rate sparkline. */
  series?: number[];
  /** Currency code for the cost figures (only 'USD' for now). */
  currency: string;
  /** ISO datetime this snapshot was computed. */
  updatedAt: string;
}

export type WidgetSize = 'small' | 'medium' | 'large';
export type WidgetStyle = 'mono' | 'colorful';

/** A floating desktop widget the user has pinned; persisted in AppSettings. */
export interface DesktopWidgetInstance {
  id: string;
  providerId: string;
  x: number;
  y: number;
  size: WidgetSize;
  style: WidgetStyle;
}

/** Per-provider user configuration (enabled + optional API key). */
export interface UsageProviderConfig {
  enabled: boolean;
  apiKey?: string | null;
  /** Optional base URL override for self-hosted gateways (LiteLLM, LLM Proxy…). */
  baseUrl?: string | null;
}
