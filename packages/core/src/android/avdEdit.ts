/**
 * Editing an AVD after it exists.
 *
 * There is no avdmanager verb for this: an AVD's settings live in its own `config.ini` and the
 * way to change one is to rewrite that line. So only what can be changed safely is offered. The
 * system image and the device profile are deliberately not editable, because changing either
 * needs the AVD's folder rebuilt and a half-rebuilt AVD is worse than no edit at all.
 *
 * The advanced half mirrors what Android Studio puts behind "Show Advanced Settings", and writes
 * the same keys, so an AVD edited here still reads correctly in Studio and the other way around.
 */

export type AvdGpuMode = 'auto' | 'host' | 'swiftshader_indirect' | 'off';

/** `virtualscene` is the 3D room the emulator renders; Studio offers it on the back camera only. */
export type AvdCamera = 'none' | 'emulated' | 'webcam0' | 'virtualscene';

export type AvdNetworkSpeed = 'full' | 'hsdpa' | 'umts' | 'edge' | 'gprs' | 'hscsd' | 'gsm';
export type AvdNetworkLatency = 'none' | 'umts' | 'edge' | 'gprs';

export interface AvdEdit {
  displayName?: string;
  ramMb?: number;
  storageMb?: number;
  gpuMode?: AvdGpuMode;
  /** Advanced, in the order Android Studio groups them. */
  vmHeapMb?: number;
  cores?: number;
  /** 0 means no SD card at all, which is a real choice rather than "unset". */
  sdCardMb?: number;
  cameraFront?: AvdCamera;
  cameraBack?: AvdCamera;
  networkSpeed?: AvdNetworkSpeed;
  networkLatency?: AvdNetworkLatency;
  keyboard?: boolean;
  deviceFrame?: boolean;
  /** Ignore the saved snapshot on every start, the way Studio's "Cold boot" option does. */
  coldBootAlways?: boolean;
}

/** What the advanced panel reads back out of a config.ini. */
export interface AvdAdvanced {
  vmHeapMb: number | null;
  cores: number;
  sdCardMb: number;
  cameraFront: AvdCamera;
  cameraBack: AvdCamera;
  networkSpeed: AvdNetworkSpeed;
  networkLatency: AvdNetworkLatency;
  keyboard: boolean;
  deviceFrame: boolean;
  coldBootAlways: boolean;
}

/** Below these the emulator either refuses to start or boots into something unusable. */
const MIN_RAM_MB = 512;
const MIN_STORAGE_MB = 512;
const MIN_VM_HEAP_MB = 16;
const MAX_CORES = 16;

function requireAtLeast(label: string, value: number, minimum: number): void {
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${label} has to be at least ${minimum} MB.`);
  }
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

/** The `config.ini` keys one edit turns into. Only what changed is written. */
export function avdConfigPatch(edit: AvdEdit): Record<string, string> {
  const patch: Record<string, string> = {};

  if (edit.displayName !== undefined) {
    const name = edit.displayName.trim();
    if (name === '') throw new Error('Give the device a name.');
    patch['avd.ini.displayname'] = name;
  }

  if (edit.ramMb !== undefined) {
    requireAtLeast('RAM', edit.ramMb, MIN_RAM_MB);
    patch['hw.ramSize'] = String(Math.round(edit.ramMb));
  }

  if (edit.storageMb !== undefined) {
    requireAtLeast('Internal storage', edit.storageMb, MIN_STORAGE_MB);
    // Written in bytes, even though the emulator's own UI talks in megabytes.
    patch['disk.dataPartition.size'] = String(Math.round(edit.storageMb) * 1024 * 1024);
  }

  if (edit.gpuMode !== undefined) {
    patch['hw.gpu.mode'] = edit.gpuMode;
    // The mode alone is ignored unless the flag agrees with it.
    patch['hw.gpu.enabled'] = edit.gpuMode === 'off' ? 'no' : 'yes';
  }

  if (edit.vmHeapMb !== undefined) {
    requireAtLeast('The VM heap', edit.vmHeapMb, MIN_VM_HEAP_MB);
    patch['vm.heapSize'] = String(Math.round(edit.vmHeapMb));
  }

  if (edit.cores !== undefined) {
    const cores = Math.round(edit.cores);
    if (!Number.isFinite(cores) || cores < 1 || cores > MAX_CORES) {
      throw new Error(`Give it between 1 and ${MAX_CORES} cores.`);
    }
    patch['hw.cpu.ncore'] = String(cores);
  }

  if (edit.sdCardMb !== undefined) {
    const size = Math.round(edit.sdCardMb);
    if (!Number.isFinite(size) || size < 0) throw new Error('An SD card cannot be negative.');
    // Both keys always move together: a size with the card switched off does nothing, and a card
    // switched on with no size makes the emulator complain at boot.
    patch['sdcard.size'] = `${size}M`;
    patch['hw.sdCard'] = yesNo(size > 0);
  }

  if (edit.cameraFront !== undefined) patch['hw.camera.front'] = edit.cameraFront;
  if (edit.cameraBack !== undefined) patch['hw.camera.back'] = edit.cameraBack;
  if (edit.networkSpeed !== undefined) patch['runtime.network.speed'] = edit.networkSpeed;
  if (edit.networkLatency !== undefined) patch['runtime.network.latency'] = edit.networkLatency;
  if (edit.keyboard !== undefined) patch['hw.keyboard'] = yesNo(edit.keyboard);
  if (edit.deviceFrame !== undefined) patch.showDeviceFrame = yesNo(edit.deviceFrame);
  if (edit.coldBootAlways !== undefined) {
    patch['fastboot.forceColdBoot'] = yesNo(edit.coldBootAlways);
  }

  return patch;
}

function readNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/** `512M`, `2G` and `512 MB` all appear in the wild, depending on what wrote the file. */
function readSdCardMb(config: Record<string, string>): number {
  if (config['hw.sdCard']?.trim() === 'no') return 0;
  const raw = config['sdcard.size']?.trim();
  if (!raw) return 0;
  const match = /^([\d.]+)\s*([KMG])?B?$/i.exec(raw);
  if (!match) return 0;
  const size = Number(match[1]);
  if (!Number.isFinite(size)) return 0;
  const unit = (match[2] ?? 'M').toUpperCase();
  if (unit === 'G') return Math.round(size * 1024);
  if (unit === 'K') return Math.round(size / 1024);
  return Math.round(size);
}

function readCamera(value: string | undefined): AvdCamera {
  const allowed: AvdCamera[] = ['none', 'emulated', 'webcam0', 'virtualscene'];
  const found = allowed.find((option) => option === value?.trim());
  return found ?? 'none';
}

/** Absent means the emulator's own default, not "off", so each fallback is its real default. */
export function avdAdvancedFromConfig(config: Record<string, string>): AvdAdvanced {
  const speeds: AvdNetworkSpeed[] = ['full', 'hsdpa', 'umts', 'edge', 'gprs', 'hscsd', 'gsm'];
  const latencies: AvdNetworkLatency[] = ['none', 'umts', 'edge', 'gprs'];

  return {
    vmHeapMb: readNumber(config['vm.heapSize']),
    cores: readNumber(config['hw.cpu.ncore']) ?? 1,
    sdCardMb: readSdCardMb(config),
    cameraFront: readCamera(config['hw.camera.front']),
    cameraBack: readCamera(config['hw.camera.back']),
    networkSpeed:
      speeds.find((speed) => speed === config['runtime.network.speed']?.trim()) ?? 'full',
    networkLatency:
      latencies.find((one) => one === config['runtime.network.latency']?.trim()) ?? 'none',
    // The emulator shows a keyboard unless something turns it off.
    keyboard: config['hw.keyboard']?.trim() !== 'no',
    deviceFrame: config.showDeviceFrame?.trim() === 'yes',
    coldBootAlways: config['fastboot.forceColdBoot']?.trim() === 'yes',
  };
}

/**
 * Rewrites the given keys in an ini file and leaves every other line exactly as it was, comments
 * included. A key that appears more than once collapses to one, since that is what the emulator
 * effectively reads anyway.
 */
export function applyIniPatch(text: string, patch: Record<string, string>): string {
  const keys = Object.keys(patch);
  if (keys.length === 0) return text;

  const remaining = new Set(keys);
  const lines = text.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const equals = line.indexOf('=');
    const key = equals > 0 ? line.slice(0, equals).trim() : null;
    if (key === null || !(key in patch)) {
      out.push(line);
      continue;
    }
    // The first occurrence is rewritten in place; any later one is dropped.
    if (remaining.has(key)) {
      out.push(`${key}=${patch[key]}`);
      remaining.delete(key);
    }
  }

  if (remaining.size > 0) {
    // A file that already ends in a newline leaves a trailing empty entry to append before.
    const tail = out.length > 0 && out.at(-1) === '' ? out.pop() : undefined;
    for (const key of remaining) out.push(`${key}=${patch[key]}`);
    if (tail !== undefined) out.push(tail);
  }

  return out.join('\n');
}
