/** Which servers the core can be installed on. */

export type OsFamily = 'debian' | 'rhel';
export type ReleaseRid = 'linux-x64' | 'linux-arm64';

export interface OsSupport {
  supported: boolean;
  family?: OsFamily;
  name: string;
  reason?: string;
}

/** The distributions the core is built and tested for, by os-release ID. */
const MATRIX: Record<string, { family: OsFamily; versions: readonly string[]; exact: boolean }> = {
  ubuntu: { family: 'debian', versions: ['22.04', '24.04', '26.04'], exact: true },
  debian: { family: 'debian', versions: ['12', '13'], exact: false },
  rhel: { family: 'rhel', versions: ['9', '10'], exact: false },
  rocky: { family: 'rhel', versions: ['9', '10'], exact: false },
  almalinux: { family: 'rhel', versions: ['9', '10'], exact: false },
  centos: { family: 'rhel', versions: ['9', '10'], exact: false },
};

const SUPPORTED_LIST =
  'Ubuntu 22.04, 24.04 or 26.04, Debian 12 or 13, and RHEL, Rocky, Alma or CentOS Stream 9 or 10';

/** Parses /etc/os-release: KEY=value lines, values optionally quoted. */
export function parseOsRelease(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals <= 0) continue;
    const key = line.slice(0, equals);
    let value = line.slice(equals + 1);
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\(["$`\\])/g, '$1');
    } else if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  return fields;
}

export function osSupport(release: Record<string, string>): OsSupport {
  const id = (release.ID ?? '').toLowerCase();
  const version = release.VERSION_ID ?? '';
  const name = release.PRETTY_NAME || `${release.NAME ?? id} ${version}`.trim();
  const entry = MATRIX[id];
  const major = version.split('.')[0];
  const matches =
    entry && (entry.exact ? entry.versions.includes(version) : entry.versions.includes(major));
  if (entry && matches) return { supported: true, family: entry.family, name };
  return {
    supported: false,
    name,
    reason: `${name || 'This operating system'} is not supported. The server core runs on ${SUPPORTED_LIST}.`,
  };
}

/** The release build for a `uname -m` answer, or null when there is none. */
export function releaseRidFor(machine: string): ReleaseRid | null {
  switch (machine.trim()) {
    case 'x86_64':
    case 'amd64':
      return 'linux-x64';
    case 'aarch64':
    case 'arm64':
      return 'linux-arm64';
    default:
      return null;
  }
}
