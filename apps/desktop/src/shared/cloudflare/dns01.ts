/**
 * Whether a server can answer DNS-01 for a site: every one of its domains (wildcards included)
 * must belong to a zone the server holds a Cloudflare DNS token for. The core decides again; this
 * only lets the SSL tab offer the option when it would work.
 */
export function zoneCovering(domain: string, zones: readonly string[]): string | null {
  const host = domain.toLowerCase().replace(/^\*\./, '');
  return (
    zones
      .filter((zone) => host === zone || host.endsWith(`.${zone}`))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

export function dns01Coverage(
  domains: readonly string[],
  zones: readonly string[],
): { covered: boolean; missing: string[]; wildcard: boolean } {
  const missing = domains.filter((domain) => zoneCovering(domain, zones) === null);
  return {
    covered: domains.length > 0 && missing.length === 0,
    missing,
    wildcard: domains.some((domain) => domain.startsWith('*.')),
  };
}
