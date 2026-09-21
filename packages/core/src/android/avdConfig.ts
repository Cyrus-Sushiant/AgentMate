/**
 * Reading an AVD's own `config.ini` is faster and more reliable than shelling out to avdmanager,
 * which needs the command-line tools and a Java runtime. avdmanager stays as the fallback for
 * AVDs whose folder cannot be read, and as the only way to see the broken ones.
 */

export interface AvdSummary {
  /** The id, which is what every command line takes. */
  name: string;
  /** What the user called it in Studio, falling back to the id. */
  displayName: string;
  device: string | null;
  manufacturer: string | null;
  api: number | null;
  tag: string | null;
  abi: string | null;
  playStore: boolean;
  ramMb: number | null;
  storageMb: number | null;
  gpuMode: string | null;
  /** Forward-slashed, since it is only ever shown or compared, never opened. */
  systemImageDir: string | null;
  path: string | null;
}

export * from './avdEdit.js';

export function parseIni(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const equals = line.indexOf('=');
    if (equals <= 0) continue;
    // Only the first `=` separates; a value is free to contain more.
    values[line.slice(0, equals).trim()] = line.slice(equals + 1).trim();
  }
  return values;
}

function numberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function avdFromConfig(
  name: string,
  config: Record<string, string>,
  path: string | null = null,
): AvdSummary {
  const sysdir = config['image.sysdir.1']?.replace(/\\/g, '/').replace(/\/+$/, '') ?? null;
  const api = sysdir ? numberOrNull(/android-(\d+)/.exec(sysdir)?.[1]) : null;
  const tag = config['tag.id'] ?? (sysdir ? (sysdir.split('/')[2] ?? null) : null);
  const bytes = numberOrNull(config['disk.dataPartition.size']);

  return {
    name,
    displayName: config['avd.ini.displayname']?.trim() || name,
    device: config['hw.device.name'] ?? null,
    manufacturer: config['hw.device.manufacturer'] ?? null,
    api,
    tag,
    abi: config['abi.type'] ?? (sysdir ? (sysdir.split('/')[3] ?? null) : null),
    playStore: config['PlayStore.enabled'] === 'true' || (tag?.includes('playstore') ?? false),
    ramMb: numberOrNull(config['hw.ramSize']),
    // The data partition is written in bytes, but every UI that shows it means megabytes.
    storageMb: bytes === null ? null : Math.round(bytes / (1024 * 1024)),
    gpuMode: config['hw.gpu.mode'] ?? null,
    systemImageDir: sysdir,
    path,
  };
}
