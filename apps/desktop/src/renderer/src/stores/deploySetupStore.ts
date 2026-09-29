import type {
  DeployInstallResult,
  DeploySetupPhase,
  DeploySetupProgress,
  DeploySetupProgressEvent,
} from '@shared/deployTypes';
import { type SshErrorCode, sshErrorCode, sshErrorMessage } from '@shared/sshErrors';
import { create } from 'zustand';
import { withHostKeyTrust } from '@/lib/ssh/hostKeyTrust';

/**
 * Installs and removals of the server core, per server. They keep running in the main process
 * when the Deploy page is left, so their progress lives here and the page picks it up again.
 */

export interface SetupRun {
  kind: 'install' | 'uninstall';
  planned: DeploySetupPhase[];
  events: DeploySetupProgress[];
  status: 'running' | 'done' | 'failed';
  error: string | null;
  errorCode: SshErrorCode | null;
  result: DeployInstallResult | null;
  /** For a removal: whether the core's data stays on the server. */
  keepData?: boolean;
}

interface DeploySetupState {
  runs: Record<string, SetupRun>;
  /** Resolves with the result, or null when the install failed or one was already running. */
  install: (
    serverId: string,
    planned: DeploySetupPhase[],
    sudoPassword: string | null,
  ) => Promise<DeployInstallResult | null>;
  /** Resolves true once the core is gone. */
  uninstall: (serverId: string, keepData: boolean, sudoPassword: string | null) => Promise<boolean>;
  clear: (serverId: string) => void;
}

export const useDeploySetupStore = create<DeploySetupState>((set, get) => {
  const update = (serverId: string, change: (run: SetupRun) => Partial<SetupRun>): void =>
    set((state) => {
      const run = state.runs[serverId];
      return run ? { runs: { ...state.runs, [serverId]: { ...run, ...change(run) } } } : state;
    });

  async function start<T>(
    serverId: string,
    kind: SetupRun['kind'],
    planned: DeploySetupPhase[],
    call: () => Promise<T>,
    extra: Partial<SetupRun> = {},
    finish: (value: T) => Partial<SetupRun> = () => ({}),
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    if (get().runs[serverId]?.status === 'running') return { ok: false };
    set((state) => ({
      runs: {
        ...state.runs,
        [serverId]: {
          kind,
          planned,
          events: [],
          status: 'running',
          error: null,
          errorCode: null,
          result: null,
          ...extra,
        },
      },
    }));
    const stop = window.agentmat.deploy.onSetupProgress((event: DeploySetupProgressEvent) => {
      if (event.serverId !== serverId) return;
      update(serverId, (run) => ({ events: [...run.events, event.progress] }));
    });
    try {
      const value = await withHostKeyTrust(serverId, call);
      // One update, so whoever sees 'done' also sees the result.
      update(serverId, () => ({ ...finish(value), status: 'done' }));
      return { ok: true, value };
    } catch (error) {
      update(serverId, () => ({
        status: 'failed',
        error: sshErrorMessage(error),
        errorCode: sshErrorCode(error),
      }));
      return { ok: false };
    } finally {
      stop();
    }
  }

  return {
    runs: {},
    install: async (serverId, planned, sudoPassword) => {
      const outcome = await start(
        serverId,
        'install',
        planned,
        () => window.agentmat.deploy.install({ serverId, sudoPassword }),
        {},
        (result) => ({ result }),
      );
      return outcome.ok ? outcome.value : null;
    },
    uninstall: async (serverId, keepData, sudoPassword) => {
      const outcome = await start(
        serverId,
        'uninstall',
        ['stop', 'remove'],
        () => window.agentmat.deploy.uninstall({ serverId, keepData, sudoPassword }),
        { keepData },
      );
      return outcome.ok;
    },
    clear: (serverId) =>
      set((state) => {
        const { [serverId]: _cleared, ...rest } = state.runs;
        return { runs: rest };
      }),
  };
});
