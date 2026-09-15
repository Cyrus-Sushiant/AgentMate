import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  DockerActionResult,
  DockerContainer,
  DockerContainerState,
  DockerRemoveOptions,
} from '../../shared/apiTypes';

const execFileAsync = promisify(execFile);
const EXEC_TIMEOUT_MS = 10_000;
/** `docker stats` has to actually sample usage once even with --no-stream, so it gets more room. */
const STATS_TIMEOUT_MS = 15_000;

const KNOWN_STATES: DockerContainerState[] = [
  'running',
  'exited',
  'paused',
  'restarting',
  'created',
  'dead',
];

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1000,
  mb: 1000 ** 2,
  gb: 1000 ** 3,
  tb: 1000 ** 4,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
};

interface RawPsEntry {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
  Labels: string;
}

interface RawStatsEntry {
  Container: string;
  CPUPerc: string;
  MemUsage: string;
}

async function run(args: string[], timeoutMs = EXEC_TIMEOUT_MS): Promise<string> {
  const { stdout } = await execFileAsync('docker', args, { timeout: timeoutMs, windowsHide: true });
  return stdout;
}

function errorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'stderr' in error &&
    typeof error.stderr === 'string' &&
    error.stderr.trim()
  ) {
    return error.stderr.trim();
  }
  return error instanceof Error ? error.message : 'Docker command failed.';
}

/** `docker ps`/`stats` print one JSON object per line, not a JSON array. */
function parseNdjson<T>(output: string): T[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function parseLabels(labels: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!labels) return result;
  for (const pair of labels.split(',')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    result[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return result;
}

function parseDockerSize(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)\s*([a-zA-Z]+)$/);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]);
  const unit = SIZE_UNITS[match[2].toLowerCase()];
  if (Number.isNaN(amount) || unit === undefined) return null;
  return amount * unit;
}

function parseMemUsage(memUsage: string): { used: number | null; limit: number | null } {
  const [usedRaw, limitRaw] = memUsage.split('/').map((part) => part.trim());
  return {
    used: usedRaw ? parseDockerSize(usedRaw) : null,
    limit: limitRaw ? parseDockerSize(limitRaw) : null,
  };
}

function normalizeState(state: string): DockerContainerState {
  const lower = state.toLowerCase();
  return (KNOWN_STATES as string[]).includes(lower) ? (lower as DockerContainerState) : 'exited';
}

/** Best-effort match between a compose label's working dir and a project's folder path. */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/** `docker stats` only reports running containers, so stopped ones simply have no entry. */
async function readStats(): Promise<Map<string, RawStatsEntry>> {
  const byContainer = new Map<string, RawStatsEntry>();
  try {
    const output = await run(['stats', '--no-stream', '--format', '{{json .}}'], STATS_TIMEOUT_MS);
    for (const entry of parseNdjson<RawStatsEntry>(output)) {
      byContainer.set(entry.Container, entry);
    }
  } catch {
    // No running containers, or stats aren't available; callers fall back to null usage.
  }
  return byContainer;
}

function toDockerContainer(
  entry: RawPsEntry,
  labels: Record<string, string>,
  stats: RawStatsEntry | undefined,
): DockerContainer {
  const usage = stats ? parseMemUsage(stats.MemUsage) : { used: null, limit: null };
  return {
    id: entry.ID,
    name: entry.Names,
    image: entry.Image,
    state: normalizeState(entry.State),
    status: entry.Status,
    composeProject: labels['com.docker.compose.project'] ?? null,
    cpuPercent: stats ? Number.parseFloat(stats.CPUPerc.replace('%', '')) : null,
    memUsedBytes: usage.used,
    memLimitBytes: usage.limit,
  };
}

interface RawEntry {
  container: DockerContainer;
  workingDir: string | null;
}

async function listRaw(): Promise<RawEntry[]> {
  // `docker stats`'s Container field is the full container ID, while `ps`'s default .ID is
  // truncated to 12 chars, so --no-trunc is required here or the two never merge.
  const [psOutput, stats] = await Promise.all([
    run(['ps', '-a', '--no-trunc', '--format', '{{json .}}']),
    readStats(),
  ]);
  return parseNdjson<RawPsEntry>(psOutput).map((entry) => {
    const labels = parseLabels(entry.Labels);
    return {
      container: toDockerContainer(entry, labels, stats.get(entry.ID)),
      workingDir: labels['com.docker.compose.project.working_dir'] ?? null,
    };
  });
}

export async function isDockerAvailable(): Promise<boolean> {
  try {
    await run(['version', '--format', 'json']);
    return true;
  } catch {
    return false;
  }
}

export async function listContainers(): Promise<DockerContainer[]> {
  return (await listRaw()).map((entry) => entry.container);
}

/**
 * Only containers started by `docker compose` inside this exact folder come back here. A plain
 * `docker run` container has no reliable link to a project folder, so it never shows up in a
 * project's Docker tab, only in the machine-wide list.
 */
export async function listContainersForProject(folderPath: string): Promise<DockerContainer[]> {
  const target = normalizePath(folderPath);
  return (await listRaw())
    .filter((entry) => entry.workingDir !== null && normalizePath(entry.workingDir) === target)
    .map((entry) => entry.container);
}

export async function startContainer(id: string): Promise<DockerActionResult> {
  try {
    await run(['start', id]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function stopContainer(id: string): Promise<DockerActionResult> {
  try {
    await run(['stop', id]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function restartContainer(id: string): Promise<DockerActionResult> {
  try {
    await run(['restart', id]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function removeContainer(
  id: string,
  { removeVolumes, removeImage }: DockerRemoveOptions,
): Promise<DockerActionResult> {
  let image: string | null = null;
  if (removeImage) {
    try {
      image = (await run(['inspect', '-f', '{{.Config.Image}}', id])).trim();
    } catch {
      image = null;
    }
  }

  try {
    await run(['rm', '-f', ...(removeVolumes ? ['-v'] : []), id]);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  if (image) {
    await run(['rmi', image]).catch(() => {
      // Best effort: the image may still be in use by another container or tag.
    });
  }

  return { ok: true };
}
