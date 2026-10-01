import type {
  CloudflareAccessMode,
  CloudflareAccessTarget,
  CloudflareSecurityLevel,
  CloudflareSslMode,
} from '@shared/cloudflareTypes';

/** The words the Cloudflare page uses for Cloudflare's values. */

export const SECURITY_LEVEL_LABELS: Record<CloudflareSecurityLevel, string> = {
  off: 'Off',
  essentially_off: 'Essentially off',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  under_attack: "I'm Under Attack",
};

export const SSL_MODE_LABELS: Record<CloudflareSslMode, string> = {
  off: 'Off (no HTTPS)',
  flexible: 'Flexible',
  full: 'Full',
  strict: 'Full (strict)',
  origin_pull: 'Strict (SSL-only origin pull)',
};

const ACCESS_MODE_LABELS: Record<CloudflareAccessMode, string> = {
  block: 'Block',
  challenge: 'Interactive challenge',
  js_challenge: 'JavaScript challenge',
  managed_challenge: 'Managed challenge',
  whitelist: 'Allow',
};

const ACCESS_TARGET_LABELS: Record<CloudflareAccessTarget, string> = {
  ip: 'IP address',
  ip6: 'IPv6 address',
  ip_range: 'IP range',
  country: 'Country',
  asn: 'Network (ASN)',
};

const RULE_ACTION_LABELS: Record<string, string> = {
  block: 'Block',
  managed_challenge: 'Managed challenge',
  challenge: 'Interactive challenge',
  js_challenge: 'JavaScript challenge',
  skip: 'Allow (skip the other rules)',
  log: 'Log',
};

export function ruleActionLabel(action: string): string {
  return RULE_ACTION_LABELS[action] ?? action;
}

export function accessModeLabel(mode: CloudflareAccessMode): string {
  return ACCESS_MODE_LABELS[mode];
}

export function accessTargetLabel(target: CloudflareAccessTarget): string {
  return ACCESS_TARGET_LABELS[target];
}

export const ACCESS_MODES = Object.keys(ACCESS_MODE_LABELS) as CloudflareAccessMode[];

export function ttlLabel(ttl: number): string {
  if (ttl === 1) return 'Auto';
  if (ttl % 86400 === 0) return ttl === 86400 ? '1 day' : `${ttl / 86400} days`;
  if (ttl % 3600 === 0) return `${ttl / 3600} hr`;
  if (ttl % 60 === 0) return `${ttl / 60} min`;
  return `${ttl} s`;
}

/** "@" for the zone itself, the label part for names inside it, anything else as it is. */
export function relativeName(name: string, zoneName: string): string {
  if (name === zoneName) return '@';
  return name.endsWith(`.${zoneName}`) ? name.slice(0, -(zoneName.length + 1)) : name;
}

/** "3 h left", "1 h 30 min left", or nothing once it has run out. */
export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return '';
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min left`;
  return rest === 0 ? `${hours} h left` : `${hours} h ${rest} min left`;
}

/** The entries of a list typed with commas, spaces or one per line. */
export function splitList(text: string): string[] {
  return text.split(/[\s,]+/).filter(Boolean);
}
