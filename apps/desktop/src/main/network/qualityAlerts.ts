import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PetPipelineMessage } from '../../shared/pet';
import { petDisplayName } from '../pet/names';
import { petManager } from '../pet/petWindow';
import { store } from '../store';

const execFileAsync = promisify(execFile);

const TICK_MS = 20_000;
const CONFIRM_SAMPLES = 2;
const FALLBACK_HOST = '1.1.1.1';

type QualityBand = 'offline' | 'poor' | 'fair' | 'good' | 'excellent';

const BAND_LABEL: Record<QualityBand, string> = {
  offline: 'offline',
  poor: 'poor',
  fair: 'fair',
  good: 'good',
  excellent: 'excellent',
};

const BAND_RANK: Record<QualityBand, number> = {
  offline: 0,
  poor: 1,
  fair: 2,
  good: 3,
  excellent: 4,
};

let timer: NodeJS.Timeout | null = null;
let ticking = false;
let lastConfirmed: QualityBand | null = null;
let pendingBand: QualityBand | null = null;
let pendingCount = 0;

function resetState(): void {
  lastConfirmed = null;
  pendingBand = null;
  pendingCount = 0;
}

async function pingHost(host: string): Promise<{ alive: boolean; latencyMs: number | null }> {
  const isWin = process.platform === 'win32';
  const args = isWin ? ['-n', '1', '-w', '1500', host] : ['-c', '1', '-W', '2', host];
  try {
    const { stdout } = await execFileAsync('ping', args, { timeout: 3000 });
    const match = isWin ? stdout.match(/time[=<](\d+)ms/i) : stdout.match(/time=([\d.]+)\s*ms/i);
    if (!match) return { alive: false, latencyMs: null };
    return { alive: true, latencyMs: Math.round(Number(match[1])) };
  } catch {
    return { alive: false, latencyMs: null };
  }
}

function bandFromLatency(latencyMs: number | null): QualityBand {
  if (latencyMs == null) return 'offline';
  if (latencyMs < 50) return 'excellent';
  if (latencyMs < 100) return 'good';
  if (latencyMs < 200) return 'fair';
  return 'poor';
}

function petNetworkSpeech(
  from: QualityBand,
  to: QualityBand,
  latencyMs: number | null,
): Pick<PetPipelineMessage, 'kind' | 'text'> {
  const ping = latencyMs != null ? ` About ${latencyMs} ms.` : '';
  if (to === 'offline') {
    return { kind: 'fail', text: 'The internet just went out.' };
  }
  if (from === 'offline') {
    return { kind: 'pass', text: `We're back online. Quality is ${BAND_LABEL[to]}.${ping}` };
  }
  if (BAND_RANK[to] < BAND_RANK[from]) {
    return {
      kind: to === 'poor' ? 'fail' : 'warn',
      text: `Internet dropped to ${BAND_LABEL[to]}.${ping}`,
    };
  }
  return { kind: 'pass', text: `Internet's better. Quality is ${BAND_LABEL[to]}.${ping}` };
}

async function sampleQuality(): Promise<{ band: QualityBand; latencyMs: number | null }> {
  const settings = await store.getSettings();
  const hosts = (settings.pingTargets ?? []).map((host) => host.trim()).filter(Boolean);
  const targets = hosts.length > 0 ? hosts : [FALLBACK_HOST];
  const results = await Promise.all(targets.map((host) => pingHost(host)));
  const alive = results.filter((result) => result.alive && result.latencyMs != null);
  if (alive.length === 0) return { band: 'offline', latencyMs: null };
  const latencyMs = Math.min(...alive.map((result) => result.latencyMs as number));
  return { band: bandFromLatency(latencyMs), latencyMs };
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const settings = await store.getSettings();
    if (!settings.desktopPetEnabled || !settings.desktopPetNetworkQuality) {
      resetState();
      return;
    }

    const { band, latencyMs } = await sampleQuality();

    // First sample after enable is the baseline, not a change.
    if (lastConfirmed == null) {
      lastConfirmed = band;
      pendingBand = null;
      pendingCount = 0;
      return;
    }

    if (band === lastConfirmed) {
      pendingBand = null;
      pendingCount = 0;
      return;
    }

    if (pendingBand !== band) {
      pendingBand = band;
      pendingCount = 1;
      return;
    }

    pendingCount += 1;
    if (pendingCount < CONFIRM_SAMPLES) return;

    const from = lastConfirmed;
    lastConfirmed = band;
    pendingBand = null;
    pendingCount = 0;
    const speech = petNetworkSpeech(from, band, latencyMs);
    petManager.sendPipelineMessage({
      kind: speech.kind,
      petName: petDisplayName(settings.desktopPetCharacterId, settings.desktopPetCustoms ?? []),
      text: speech.text,
    });
  } catch {
    // A failed ping sample is retried on the next tick.
  } finally {
    ticking = false;
  }
}

export function startNetworkQualityAlertWatcher(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  void tick();
}

export function stopNetworkQualityAlertWatcher(): void {
  if (timer) clearInterval(timer);
  timer = null;
  ticking = false;
  resetState();
}
