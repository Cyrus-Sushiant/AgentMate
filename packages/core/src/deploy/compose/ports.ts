import { validateIpAddress } from '../validation.js';
import type { ComposeProject } from './parse.js';

/**
 * Which ports each service publishes, and on which addresses. A published port bypasses the host
 * firewall (Docker writes its own rules), so where it is bound matters: "every interface" is
 * reachable from the internet unless something else stops it.
 *
 * Entries are read the way Compose reads them: the short syntax split as docker/go-connections'
 * ParsePortSpec splits it (`[IP:][HOST:]CONTAINER[/PROTOCOL]`, IPv6 with or without brackets,
 * matching ranges expanded one port per binding), and the long syntax field by field.
 */

export type ComposePortExposure = 'all-interfaces' | 'loopback' | 'specific';

export interface ComposePortSpec {
  /** The address the port is published on. Null is Docker's default: every interface. */
  hostIp: string | null;
  /** Host port, or a range Docker picks a free port from. Null lets Docker pick any. */
  published: string | null;
  target: number;
  protocol: 'tcp' | 'udp' | 'sctp';
  exposure: ComposePortExposure;
  /** Long syntax `name`. */
  name: string | null;
  /** Long syntax `app_protocol`. */
  appProtocol: string | null;
}

export interface ComposePortBinding extends ComposePortSpec {
  service: string;
  /** Position of the entry in the service's `ports:` list. */
  index: number;
}

export interface ComposeServicePorts {
  service: string;
  /** `network_mode: host`: everything the service listens on is on the host, published or not. */
  hostNetwork: boolean;
  bindings: ComposePortBinding[];
  /** `expose:`, reachable from other containers only. */
  exposed: string[];
  /** Entries that could not be read, by position (-1 when `ports:` itself is wrong). */
  problems: { index: number; reason: string }[];
}

export type ComposePortRead =
  | { ok: true; bindings: ComposePortSpec[] }
  | { ok: false; reason: string };

/** One entry may not fan out into more bindings than this. */
export const MAX_PORTS_PER_ENTRY = 1000;

const PROTOCOLS = new Set(['tcp', 'udp', 'sctp']);

const UNRESOLVED = 'uses ${...}, which only has a value once the environment is known.';

type Range = { start: number; end: number };

function shown(entry: unknown): string {
  const text = JSON.stringify(entry) ?? String(entry);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function exposureOf(hostIp: string | null): ComposePortExposure {
  if (hostIp === null || hostIp === '0.0.0.0' || hostIp === '::') return 'all-interfaces';
  if (hostIp.startsWith('127.') || hostIp === '::1' || hostIp.startsWith('::ffff:127.')) {
    return 'loopback';
  }
  return 'specific';
}

/** A port or `start-end`, as nat.parsePortRange reads it, from 1 to 65535. */
function readRange(text: string): Range | string {
  const match = /^([0-9]+)(?:-([0-9]+))?$/.exec(text);
  if (!match) return `${JSON.stringify(text)} is not a port or a range of ports.`;
  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  if (start < 1 || end < 1 || start > 65535 || end > 65535) return 'Ports go from 1 to 65535.';
  if (end < start) return `The range ${text} runs backwards.`;
  return { start, end };
}

function readHostIp(raw: string): string | { problem: string } {
  const bracketed = raw.startsWith('[');
  if (bracketed && !raw.endsWith(']')) {
    return { problem: `has the host address ${raw}, which isn't an IP address Docker can read.` };
  }
  const address = validateIpAddress(bracketed ? raw.slice(1, -1) : raw);
  return address.ok
    ? address.value.address
    : { problem: `has the host address ${raw}, which isn't an IP address: ${address.reason}` };
}

function readProtocol(raw: string): ComposePortSpec['protocol'] | null {
  const protocol = raw === '' ? 'tcp' : raw.toLowerCase();
  return PROTOCOLS.has(protocol) ? (protocol as ComposePortSpec['protocol']) : null;
}

function spec(
  target: number,
  published: string | null,
  hostIp: string | null,
  protocol: ComposePortSpec['protocol'],
  name: string | null = null,
  appProtocol: string | null = null,
): ComposePortSpec {
  return { hostIp, published, target, protocol, exposure: exposureOf(hostIp), name, appProtocol };
}

export interface ComposePortReadOptions {
  /**
   * The values were already interpolated, so a `$` left in them is a literal character (it was
   * written `$$`), not a variable still waiting for a value.
   */
  interpolated?: boolean;
}

/** One entry of a service's `ports:` list, as the bindings Docker would create for it. */
export function readComposePortEntry(
  entry: unknown,
  options: ComposePortReadOptions = {},
): ComposePortRead {
  if (typeof entry === 'number') {
    return Number.isInteger(entry) && entry >= 1 && entry <= 65535
      ? { ok: true, bindings: [spec(entry, null, null, 'tcp')] }
      : { ok: false, reason: `${shown(entry)} is not a port.` };
  }
  const interpolated = options.interpolated === true;
  const read =
    typeof entry === 'string'
      ? readShort(entry, interpolated)
      : entry !== null && typeof entry === 'object' && !Array.isArray(entry)
        ? readLong(entry as Record<string, unknown>, interpolated)
        : `${shown(entry)} is not a port mapping.`;
  return typeof read === 'string' ? { ok: false, reason: read } : { ok: true, bindings: read };
}

function readShort(raw: string, interpolated: boolean): ComposePortSpec[] | string {
  if (!interpolated && raw.includes('$')) return `${shown(raw)} ${UNRESOLVED}`;
  const parts = raw.split(':');
  const count = parts.length;
  const ip = count > 2 ? parts.slice(0, count - 2).join(':') : '';
  const host = count > 1 ? parts[count - 2] : '';
  const slash = parts[count - 1].indexOf('/');
  const container = slash < 0 ? parts[count - 1] : parts[count - 1].slice(0, slash);
  if (container === '') return `${shown(raw)} has no container port.`;
  const protocol = readProtocol(slash < 0 ? '' : parts[count - 1].slice(slash + 1));
  if (!protocol)
    return `${shown(raw)} uses a protocol Docker cannot publish; use tcp, udp or sctp.`;

  let hostIp: string | null = null;
  if (ip !== '') {
    const read = readHostIp(ip);
    if (typeof read !== 'string') return `${shown(raw)} ${read.problem}`;
    hostIp = read;
  }
  const targets = readRange(container);
  if (typeof targets === 'string') return `${shown(raw)}: ${targets}`;
  let hosts: Range | null = null;
  if (host !== '') {
    const read = readRange(host);
    if (typeof read === 'string') return `${shown(raw)}: ${read}`;
    hosts = read;
  }
  const size = targets.end - targets.start + 1;
  if (hosts && hosts.end - hosts.start + 1 !== size && size !== 1) {
    return `${shown(raw)}: the host and container ranges differ in size.`;
  }
  if (size > MAX_PORTS_PER_ENTRY) {
    return `${shown(raw)} covers more than ${MAX_PORTS_PER_ENTRY} ports. Publish fewer, or use host networking on purpose.`;
  }

  const bindings: ComposePortSpec[] = [];
  for (let offset = 0; offset < size; offset++) {
    let published: string | null = null;
    if (hosts) {
      published =
        size === 1 && hosts.start !== hosts.end
          ? `${hosts.start}-${hosts.end}`
          : String(hosts.start + offset);
    }
    bindings.push(spec(targets.start + offset, published, hostIp, protocol));
  }
  return bindings;
}

function readLong(
  entry: Record<string, unknown>,
  interpolated: boolean,
): ComposePortSpec[] | string {
  const values = Object.values(entry);
  if (!interpolated && values.some((value) => typeof value === 'string' && value.includes('$'))) {
    return `${shown(entry)} ${UNRESOLVED}`;
  }
  const { target, published, host_ip: rawIp, protocol: rawProtocol, name, app_protocol } = entry;

  let port: number;
  if (typeof target === 'number' && Number.isInteger(target)) {
    port = target;
  } else if (typeof target === 'string' && /^[0-9]+$/.test(target)) {
    port = Number(target);
  } else if (typeof target === 'string' && target.includes('-')) {
    return `${shown(entry)}: the long syntax takes one container port per entry.`;
  } else {
    return `${shown(entry)} has no target (container) port.`;
  }
  if (port < 1 || port > 65535) return `${shown(entry)}: Ports go from 1 to 65535.`;

  let hostPort: string | null = null;
  if (typeof published === 'number' || (typeof published === 'string' && published !== '')) {
    const range = readRange(String(published));
    if (typeof range === 'string') return `${shown(entry)}: ${range}`;
    hostPort = range.start === range.end ? String(range.start) : `${range.start}-${range.end}`;
  } else if (published !== undefined && published !== null && published !== '') {
    return `${shown(entry)} has a published port that is not a number.`;
  }

  let hostIp: string | null = null;
  if (typeof rawIp === 'string' && rawIp !== '') {
    const read = readHostIp(rawIp);
    if (typeof read !== 'string') return `${shown(entry)} ${read.problem}`;
    hostIp = read;
  }
  const protocol = readProtocol(typeof rawProtocol === 'string' ? rawProtocol : '');
  if (!protocol)
    return `${shown(entry)} uses a protocol Docker cannot publish; use tcp, udp or sctp.`;

  return [
    spec(
      port,
      hostPort,
      hostIp,
      protocol,
      typeof name === 'string' ? name : null,
      typeof app_protocol === 'string' ? app_protocol : null,
    ),
  ];
}

/** The ports of every service in the project, in file order. */
export function analyzeComposePorts(project: ComposeProject): ComposeServicePorts[] {
  return project.services.map(({ name, definition }) => {
    const result: ComposeServicePorts = {
      service: name,
      hostNetwork: definition.network_mode === 'host',
      bindings: [],
      exposed: [],
      problems: [],
    };
    const { ports, expose } = definition;
    if (Array.isArray(ports)) {
      for (const [index, entry] of ports.entries()) {
        const read = readComposePortEntry(entry, { interpolated: project.interpolated });
        if (read.ok) {
          result.bindings.push(
            ...read.bindings.map((binding) => ({ ...binding, service: name, index })),
          );
        } else {
          result.problems.push({ index, reason: read.reason });
        }
      }
    } else if (ports !== undefined && ports !== null) {
      result.problems.push({ index: -1, reason: `ports: of ${name} must be a list.` });
    }
    if (Array.isArray(expose)) {
      for (const item of expose) {
        if (typeof item === 'string' || typeof item === 'number') result.exposed.push(String(item));
      }
    }
    return result;
  });
}
