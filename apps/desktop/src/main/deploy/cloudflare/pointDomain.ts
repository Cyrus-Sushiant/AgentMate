import { recordName } from '../../../shared/cloudflare/dns';
import { canonicalIp, ipVersion, isPublicAddress } from '../../../shared/cloudflare/ip';
import type { CloudflareDnsRecord, CloudflarePlannedChange } from '../../../shared/cloudflareTypes';

/**
 * "Point domain to this server": the address records a name needs so that it reaches one server
 * and nothing else. The plan is worked out from the records the zone has, so running it again
 * finds every record already right and changes nothing (AC2). Addresses come from a source the
 * service is given; for now that is the saved server's host, and a later epic feeds it the
 * public addresses the server core reports.
 */

export interface ServerAddresses {
  ipv4: string[];
  ipv6: string[];
}

export type LookupAll = (host: string) => Promise<Array<{ address: string; family: number }>>;

/** The full names to point: the one asked for, and its www when wanted. Null for a bad name. */
export function pointedNames(name: string, zoneName: string, includeWww: boolean): string[] | null {
  const full = recordName(name, zoneName);
  if (!full || full.startsWith('*')) return null;
  return includeWww && !full.startsWith('www.') ? [full, `www.${full}`] : [full];
}

function planFamily(
  type: 'A' | 'AAAA',
  name: string,
  wanted: string[],
  existing: CloudflareDnsRecord[],
  proxied: boolean,
): CloudflarePlannedChange[] {
  const remaining = [...new Set(wanted.map((address) => canonicalIp(address) ?? address))];
  const settled: CloudflarePlannedChange[] = [];
  const leftover: CloudflareDnsRecord[] = [];
  for (const record of existing) {
    const content = canonicalIp(record.content) ?? record.content;
    const index = remaining.indexOf(content);
    if (index < 0) {
      leftover.push(record);
      continue;
    }
    remaining.splice(index, 1);
    settled.push(
      record.proxied === proxied
        ? { action: 'keep', type, name, content, proxied, recordId: record.id }
        : {
            action: 'update',
            type,
            name,
            content,
            previous: content,
            proxied,
            recordId: record.id,
          },
    );
  }
  const changes: CloudflarePlannedChange[] = [...settled];
  for (const record of leftover) {
    const content = remaining.shift();
    changes.push(
      content === undefined
        ? {
            action: 'delete',
            type,
            name,
            content: record.content,
            proxied: record.proxied,
            recordId: record.id,
            reason: 'other-address',
          }
        : {
            action: 'update',
            type,
            name,
            content,
            previous: record.content,
            proxied,
            recordId: record.id,
          },
    );
  }
  for (const content of remaining) changes.push({ action: 'create', type, name, content, proxied });
  // Removals last within the family, so the plan reads: what stays, what changes, what goes.
  return [
    ...changes.filter((change) => change.action !== 'delete'),
    ...changes.filter((change) => change.action === 'delete'),
  ];
}

/** The changes, name by name: CNAMEs out of the way first, then IPv4, then IPv6. */
export function planChanges(input: {
  names: string[];
  addresses: ServerAddresses;
  proxied: boolean;
  existing: CloudflareDnsRecord[];
}): CloudflarePlannedChange[] {
  const changes: CloudflarePlannedChange[] = [];
  for (const name of input.names) {
    const at = input.existing.filter((record) => record.name === name);
    for (const record of at.filter((candidate) => candidate.type === 'CNAME')) {
      changes.push({
        action: 'delete',
        type: 'CNAME',
        name,
        content: record.content,
        proxied: record.proxied,
        recordId: record.id,
        reason: 'cname-conflict',
      });
    }
    const of = (type: string) => at.filter((record) => record.type === type);
    changes.push(...planFamily('A', name, input.addresses.ipv4, of('A'), input.proxied));
    changes.push(...planFamily('AAAA', name, input.addresses.ipv6, of('AAAA'), input.proxied));
  }
  return changes;
}

function split(addresses: string[]): ServerAddresses {
  return {
    ipv4: addresses.filter((address) => ipVersion(address) === 4),
    ipv6: addresses.filter((address) => ipVersion(address) === 6),
  };
}

/**
 * A saved server's public addresses from its host: the address itself, or what the name resolves
 * to. Private and local addresses are left out, since a public DNS record pointing at one would
 * send visitors nowhere.
 */
export async function addressesOfHost(host: string, lookup: LookupAll): Promise<ServerAddresses> {
  const literal = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (ipVersion(literal)) {
    if (!isPublicAddress(literal)) {
      throw new Error(
        `${literal} is a private or local address, which the internet cannot reach. Save the server with its public address, or point the record by hand.`,
      );
    }
    return split([canonicalIp(literal) ?? literal]);
  }
  let found: Array<{ address: string }>;
  try {
    found = await lookup(host);
  } catch {
    throw new Error(`Could not look up ${host}. Check the saved server's address.`);
  }
  const all = [...new Set(found.map(({ address }) => canonicalIp(address) ?? address))];
  if (all.length === 0) throw new Error(`Could not find any address for ${host}.`);
  const reachable = all.filter(isPublicAddress);
  if (reachable.length === 0) {
    throw new Error(
      `${host} only resolves to private or local addresses (${all.join(', ')}), which the internet cannot reach.`,
    );
  }
  return split(reachable);
}

/**
 * The public addresses the server core reports (its own view of the machine, E05), when it has
 * any the internet can reach. Null sends the caller back to the saved server's host.
 */
export function addressesFromCore(publicAddresses: readonly string[]): ServerAddresses | null {
  const reachable = [
    ...new Set(publicAddresses.map((address) => canonicalIp(address) ?? address)),
  ].filter((address) => ipVersion(address) !== null && isPublicAddress(address));
  return reachable.length > 0 ? split(reachable) : null;
}
