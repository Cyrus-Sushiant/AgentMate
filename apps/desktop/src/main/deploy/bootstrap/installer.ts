import { readFile } from 'node:fs/promises';
import { quoteForShell } from '@agentmat/core';
import type { HealthResponse } from '../../../shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type {
  DeployInstallResult,
  DeploySetupPhase,
  DeploySetupProgress,
} from '../../../shared/deployTypes';
import { sshErrorMessage } from '../../../shared/sshErrors';
import {
  type ExecOptions,
  type ExecResult,
  type SshConnection,
  TunnelRefusedError,
} from '../../ssh/connection';
import { openRootShell, type RootShell } from '../../ssh/sudo';
import type { CoreTransportKind } from '../connection/transport';
import {
  CHECKSUM_MISMATCH_EXIT,
  type InstallStepId,
  installSteps,
  isReleasePath,
  type PlanStep,
  releaseDirectory,
  rollbackSteps,
  uninstallSteps,
} from './installPlan';
import { type PreflightConnection, runPreflight } from './preflight';
import type { ReleaseSource } from './releaseSource';

/**
 * Installs or upgrades the server core on a saved server over SSH:
 *
 * 1. A read-only preflight, then root access (a sudo password is checked on its own first).
 * 2. The release for the server's processor, already checked against the app's manifest.
 * 3. An upload into a fresh folder the login user owns.
 * 4. The install plan's root steps in order. The server checks the checksum again, in a folder
 *    only root can write to, before anything is unpacked.
 * 5. A new login when the login is not root, since the agentmate group only applies to new
 *    logins, and a health check through the same tunnel the app uses from then on.
 *
 * Once the server has started switching to the new release, a failure to start or to answer
 * switches it back to the release it ran before, when there was one.
 */

export type InstallPhase = DeploySetupPhase;
export type InstallProgress = DeploySetupProgress;

/** An install's outcome, plus what the preflight saw, for the app's record of the server. */
export interface InstalledCore extends DeployInstallResult {
  os: string;
  architecture: string;
}

/** What the installer needs from an SSH connection. */
export type InstallerConnection = PreflightConnection &
  Pick<SshConnection, 'upload' | 'createStagingDirectory' | 'openExecStream'>;

export interface InstallerLease {
  connection: InstallerConnection;
  release: () => void;
}

export interface InstallerDeps {
  /** The server's pooled connection. `fresh` logs in again, so new group membership applies. */
  connect: (serverId: string, options?: { fresh?: boolean }) => Promise<InstallerLease>;
  releases: ReleaseSource;
  /** Asks the core for its health through the given transport. */
  health: (
    connection: InstallerConnection,
    transport: CoreTransportKind,
  ) => Promise<HealthResponse>;
}

export interface InstallRequest {
  serverId: string;
  /** The sudo password; null falls back to the saved login password, if there is one. */
  sudoPassword: string | null;
  onProgress?: (event: InstallProgress) => void;
}

export interface UninstallRequest extends InstallRequest {
  keepData: boolean;
}

const STEP_TIMEOUT_MS = 180_000;
const STEP_OPTIONS: ExecOptions = { timeoutMs: STEP_TIMEOUT_MS, maxOutputBytes: 64 * 1024 };
const JOURNAL_COMMAND = 'journalctl -u agentmate-core -n 30 --no-pager -o cat';
const FAILURE_DETAIL_CHARS = 1_500;
/** Once these steps begin, the server may no longer run the release it had. */
const SWITCHING_STEPS: ReadonlySet<InstallStepId> = new Set(['unit', 'switch', 'start']);

const TITLES = {
  preflight: 'Check the server',
  download: 'Get the server core',
  upload: 'Upload it to the server',
  health: 'Check that the core answers',
} as const;

function succeeded(result: ExecResult): boolean {
  return result.exitCode === 0 && !result.timedOut;
}

/** What went wrong with a root command, in the command's own words where it gave any. */
function commandFailure(result: ExecResult): string {
  if (result.timedOut) return `no answer within ${STEP_TIMEOUT_MS / 60_000} minutes`;
  const text = result.stderr.trim() || result.stdout.trim();
  if (text) {
    return text.length > FAILURE_DETAIL_CHARS ? `...${text.slice(-FAILURE_DETAIL_CHARS)}` : text;
  }
  return result.exitCode === null ? 'the command was stopped' : `exit code ${result.exitCode}`;
}

function stepFailure(step: PlanStep, result: ExecResult, version: string): string {
  if (step.id === 'verify' && result.exitCode === CHECKSUM_MISMATCH_EXIT) {
    return 'The copy on the server does not match its published checksum, so nothing was installed.';
  }
  if (step.id === 'start') return `Server core ${version} did not start.`;
  return `${step.title} failed: ${commandFailure(result)}`;
}

type Phase = <T>(
  id: InstallPhase,
  title: string,
  work: (note: (detail: string) => void) => Promise<T>,
) => Promise<T>;

/** Runs one phase and reports it. `note` adds a remark to a phase that still succeeded. */
function phaseReporter(emit: (event: InstallProgress) => void): Phase {
  return async (id, title, work) => {
    emit({ phase: id, title, status: 'running' });
    let remark = null as string | null;
    try {
      const result = await work((detail) => {
        remark = detail;
      });
      emit({ phase: id, title, status: 'done', ...(remark === null ? {} : { detail: remark }) });
      return result;
    } catch (error) {
      emit({ phase: id, title, status: 'failed', detail: sshErrorMessage(error) });
      throw error;
    }
  };
}

export async function installCore(
  deps: InstallerDeps,
  request: InstallRequest,
): Promise<InstalledCore> {
  const emit = (event: InstallProgress) => request.onProgress?.(event);
  const phase = phaseReporter(emit);

  let lease = await deps.connect(request.serverId);
  const password = request.sudoPassword ?? lease.connection.endpoint.password ?? null;
  let root: RootShell | null = null;
  const rootShell = async (): Promise<RootShell> => {
    root ??= await openRootShell(lease.connection, password);
    return root;
  };

  try {
    const { report, rid } = await phase('preflight', TITLES.preflight, async () => {
      const found = await runPreflight(lease.connection);
      if (found.problems.length > 0 || !found.architecture.rid) {
        throw new Error(`This server cannot take the server core yet. ${found.problems.join(' ')}`);
      }
      await rootShell();
      return { report: found, rid: found.architecture.rid };
    });

    const release = await phase('download', TITLES.download, () => deps.releases.release(rid));
    const target = releaseDirectory(release.version, release.sha256);
    const installed = report.installed;
    // Only a release folder the installer made, and not the one being reinstalled.
    const previous =
      installed && isReleasePath(installed.release) && installed.release !== target
        ? installed
        : null;

    /** Reads the core's last log lines, for a release that would not start or answer. */
    const readJournal = async (): Promise<string | null> => {
      try {
        const result = await (await rootShell()).run(JOURNAL_COMMAND, {
          timeoutMs: 30_000,
          maxOutputBytes: 16 * 1024,
        });
        return result.stdout.trim() || null;
      } catch {
        return null;
      }
    };

    /** Puts the previous release back, if there was one, and explains what happened. */
    const recover = async (reason: string): Promise<Error> => {
      const journal = await readJournal();
      let aftermath = '';
      if (previous) {
        try {
          for (const step of rollbackSteps(previous.release)) {
            await phase(step.id, step.title, async () => {
              const result = await (await rootShell()).run(step.command, STEP_OPTIONS);
              if (!succeeded(result)) throw new Error(commandFailure(result));
            });
          }
          aftermath = ` The server went back to ${previous.version}.`;
        } catch (error) {
          aftermath = ` Going back to ${previous.version} failed too: ${sshErrorMessage(error)}`;
        }
      }
      const logged = journal ? `\n\nWhat the core logged:\n${journal}` : '';
      return new Error(`${reason}${aftermath}${logged}`);
    };

    let stagingDirectory = null as string | null;
    const shell = await rootShell();
    try {
      const stagingFile = await phase('upload', TITLES.upload, async () => {
        const content = await readFile(release.localPath);
        stagingDirectory = await lease.connection.createStagingDirectory();
        const path = `${stagingDirectory}/${release.file}`;
        let reported = -1;
        await lease.connection.upload(content, path, {
          mode: 0o600,
          onProgress: (sent, total) => {
            const percent = total > 0 ? Math.floor((sent / total) * 100) : 100;
            if (percent === reported) return;
            reported = percent;
            emit({ phase: 'upload', title: TITLES.upload, status: 'running', percent });
          },
        });
        return path;
      });

      const steps = installSteps({
        version: release.version,
        sha256: release.sha256,
        file: release.file,
        stagingFile,
        loginUser: lease.connection.endpoint.username,
        rootLogin: shell.mode === 'root',
        selinux: report.selinux === 'enforcing' || report.selinux === 'permissive',
        previousRelease: previous?.release ?? null,
      });

      for (const step of steps) {
        try {
          await phase(step.id, step.title, async (note) => {
            const result = await shell.run(step.command, STEP_OPTIONS);
            if (succeeded(result)) return;
            // The new release already runs; leftovers go with the next install's cleanup.
            if (step.id === 'cleanup') {
              note(`Some old files were left behind: ${commandFailure(result)}`);
              return;
            }
            throw new Error(stepFailure(step, result, release.version));
          });
        } catch (error) {
          if (!SWITCHING_STEPS.has(step.id)) throw error;
          throw await recover(sshErrorMessage(error));
        }
      }
    } finally {
      if (stagingDirectory) {
        await lease.connection
          .exec(`rm -rf ${quoteForShell(stagingDirectory, 'posix')}`, { timeoutMs: 30_000 })
          .catch(() => undefined);
      }
    }

    let transport: InstalledCore['transport'] =
      report.streamLocal === 'prohibited' ? 'bridge' : 'streamlocal';
    try {
      await phase('health', TITLES.health, async () => {
        if (shell.mode !== 'root') {
          lease.release();
          lease = await deps.connect(request.serverId, { fresh: true });
          root = null;
        }
        let health: HealthResponse;
        try {
          try {
            health = await deps.health(lease.connection, transport);
          } catch (error) {
            // OpenSSH answers a tunnel it may not open the same way as one to a socket that is
            // not there, so the preflight cannot always tell. The socket exists now: a refusal
            // means sshd does not allow the tunnel, and the core's bridge is the way in.
            if (transport === 'bridge' || !(error instanceof TunnelRefusedError)) throw error;
            transport = 'bridge';
            health = await deps.health(lease.connection, transport);
          }
        } catch (error) {
          throw new Error(
            `Server core ${release.version} started, but the app cannot reach it: ${sshErrorMessage(error)}`,
          );
        }
        if (health.version !== release.version) {
          throw new Error(`The server core answers as ${health.version}, not ${release.version}.`);
        }
      });
    } catch (error) {
      throw await recover(sshErrorMessage(error));
    }

    return {
      version: release.version,
      release: target,
      transport,
      previousVersion: installed?.version ?? null,
      os: report.os.name,
      architecture: report.architecture.machine,
    };
  } finally {
    lease.release();
  }
}

/** Stops and removes the core, keeping its data folder and settings when asked to. */
export async function uninstallCore(
  deps: Pick<InstallerDeps, 'connect'>,
  request: UninstallRequest,
): Promise<void> {
  const phase = phaseReporter((event) => request.onProgress?.(event));
  const lease = await deps.connect(request.serverId);
  try {
    const password = request.sudoPassword ?? lease.connection.endpoint.password ?? null;
    const shell = await openRootShell(lease.connection, password);
    for (const step of uninstallSteps({ keepData: request.keepData })) {
      await phase(step.id, step.title, async () => {
        const result = await shell.run(step.command, STEP_OPTIONS);
        if (!succeeded(result)) throw new Error(`${step.title} failed: ${commandFailure(result)}`);
      });
    }
  } finally {
    lease.release();
  }
}
