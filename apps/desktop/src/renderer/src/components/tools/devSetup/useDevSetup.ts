import {
  applyJobEvent,
  buildChecklist,
  buildInstallPlan,
  type Checklist,
  collectConsents,
  DEV_STACKS,
  type DevDetection,
  type DevItemId,
  type DevItemJob,
  type DevJobState,
  type DevSetupEnvironment,
  EMPTY_JOB_STATE,
  type InstallPlan,
  itemsForStacks,
  missingItemIds,
  normalizeDevSetupStacks,
} from '@agentmat/core';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { confirmDialog } from '@/stores/confirmStore';
import { useTerminalStore } from '@/stores/terminalStore';

/** How often a row that was handed to the terminal checks whether the tool has turned up. */
const POLL_MS = 5_000;
/** After this long the row stops waiting and goes back to offering the install. */
const GIVE_UP_MS = 10 * 60_000;
/** What main refuses with when a step carries an agreement the request did not accept. */
const CONSENT_REQUIRED = 'consent-required';

export interface TerminalHandoff {
  id: DevItemId;
  name: string;
  command: string;
}

export interface UseDevSetup {
  environment: DevSetupEnvironment | undefined;
  /** The machine could not be described at all, which leaves nothing to check against. */
  environmentFailed: boolean;
  retryEnvironment: () => void;
  stacks: string[];
  toggleStack: (id: string) => void;
  /** Undefined until the machine has been described. */
  checklist: Checklist | undefined;
  /** The install run, as main has reported it. */
  job: DevJobState;
  /** What "Install all missing" would do right now. */
  plan: InstallPlan | undefined;
  install: (ids: readonly DevItemId[]) => Promise<void>;
  installAll: () => Promise<void>;
  /** With an id, takes that waiting step out of the queue; without, stops the whole run. */
  cancel: (id?: DevItemId) => void;
  recheck: (id: DevItemId) => void;
  recheckAll: () => void;
  openInTerminal: (handoff: TerminalHandoff) => void;
  copyCommand: (handoff: Pick<TerminalHandoff, 'name' | 'command'>) => Promise<void>;
  /** Puts a tool that is installed but off PATH onto the user PATH. Says how it went; never throws. */
  addToPath: (target: { id: DevItemId; name: string }) => Promise<void>;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Could not check this.';
}

/** Electron wraps a handler's error as "Error invoking remote method 'x': Error: the message". */
function plainMessage(error: unknown): string {
  return messageOf(error).replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/, '');
}

/**
 * Everything the Dev Setup panel needs: the chosen stacks, one independent probe per item (so a
 * slow `dotnet` never holds up `git`), the install run as main reports it, and the hand-off to a
 * terminal for installs the app does not run itself. What each row says comes from `devSetupView`;
 * this only gathers and acts.
 */
export function useDevSetup(): UseDevSetup {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
    meta: { silentLoading: true },
  });
  const saveStacks = useMutation({
    mutationFn: (next: string[]) => window.agentmat.settings.update({ devSetupStacks: next }),
    meta: { silentLoading: true },
    // Returned, so the save counts as in flight until the fresh settings have arrived. Without
    // that the chips would flash back to the old choice for the moment between the two.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
    onError: () => toast.error('Could not save your choice.'),
  });
  // While a save is in flight the chips show the choice being saved, so they do not snap back.
  const pendingStacks = saveStacks.isPending ? saveStacks.variables : undefined;
  const stacks = normalizeDevSetupStacks(pendingStacks ?? settingsQuery.data?.devSetupStacks);

  const environmentQuery = useQuery({
    queryKey: queryKeys.devSetupEnvironment,
    queryFn: () => window.agentmat.devSetup.environment({ force: true }),
    meta: { silentLoading: true },
    staleTime: 30_000,
  });
  const environment = environmentQuery.data;

  const [waiting, setWaiting] = useState<Record<DevItemId, number>>({});
  const [job, setJob] = useState<DevJobState>(EMPTY_JOB_STATE);

  // Follow the run. A window opened half way through one has missed the earlier events, so it asks
  // for the current state too, but never lets that answer replace events already received.
  useEffect(() => {
    let live = true;
    const unsubscribe = window.agentmat.devSetup.onEvent((event) => {
      setJob((current) => applyJobEvent(current, event));
    });
    void window.agentmat.devSetup
      .jobState()
      .then((snapshot) => {
        if (live && snapshot) setJob((current) => (current.jobId === null ? snapshot : current));
      })
      .catch(() => undefined);
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  const items = environment ? itemsForStacks(stacks, environment.os) : [];
  const probes = useQueries({
    queries: items.map((item) => ({
      queryKey: queryKeys.devSetupItem(item.id),
      queryFn: () => window.agentmat.devSetup.detect(item.id, { force: true }),
      meta: { silentLoading: true },
      staleTime: 10_000,
      refetchInterval: waiting[item.id] ? POLL_MS : false,
    })),
  });

  const detections: Record<DevItemId, DevDetection | undefined> = {};
  items.forEach((item, index) => {
    const probe = probes[index];
    if (!probe) return;
    if (probe.data) detections[item.id] = probe.data;
    else if (probe.isError)
      detections[item.id] = { state: 'error', message: messageOf(probe.error) };
  });

  // What the installer is doing wins over a row that was only handed to the terminal.
  const jobs: Record<DevItemId, DevItemJob | undefined> = {};
  for (const id of Object.keys(waiting)) jobs[id] = { status: 'waiting-terminal' };
  Object.assign(jobs, job.items);

  const checklist = environment
    ? buildChecklist({ stacks, environment, detections, jobs })
    : undefined;
  const plan =
    checklist && environment
      ? buildInstallPlan(missingItemIds(checklist.entries), checklist.entries, environment.os)
      : undefined;

  // Main has already looked again at an item that finished, so this page does too, straight away.
  const looked = useRef(new Set<string>());
  useEffect(() => {
    for (const id of job.completed) {
      const key = `${job.jobId}:${id}`;
      if (looked.current.has(key)) continue;
      looked.current.add(key);
      void queryClient.invalidateQueries({ queryKey: queryKeys.devSetupItem(id) });
    }
  }, [job.completed, job.jobId, queryClient]);

  // The nav badge counts what is missing, so it is told when a run ends.
  useEffect(() => {
    if (!job.running && job.jobId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.devSetupPeek });
    }
  }, [job.running, job.jobId, queryClient]);

  // A row stops waiting for the terminal the moment its tool shows up.
  const arrived = checklist
    ? Object.keys(waiting).filter(
        (id) => checklist.rows.find((row) => row.item.id === id)?.state.kind === 'installed',
      )
    : [];
  const arrivedKey = arrived.join(',');
  useEffect(() => {
    if (!arrivedKey) return;
    const done = new Set(arrivedKey.split(','));
    setWaiting((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => !done.has(id)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [arrivedKey]);

  // ...and gives up on one that never does, so a closed terminal does not poll forever.
  const waitingCount = Object.keys(waiting).length;
  useEffect(() => {
    if (waitingCount === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setWaiting((current) => {
        const next = Object.fromEntries(
          Object.entries(current).filter(([, startedAt]) => now - startedAt < GIVE_UP_MS),
        );
        return Object.keys(next).length === Object.keys(current).length ? current : next;
      });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [waitingCount]);

  function acceptAgreements(consents: ReturnType<typeof collectConsents>): Promise<boolean> {
    // The person agrees to these by pressing the button, so they are named before it runs.
    return confirmDialog({
      title: 'Accept the agreements?',
      description:
        'Installing these means you accept their terms. You can read them at the addresses below.',
      items: consents.map((consent) => ({ name: consent.title, detail: consent.url })),
      confirmLabel: 'Accept and install',
    });
  }

  /** The agreements the install would carry once every item has been looked at again. */
  async function consentsAfterRecheck(ids: readonly DevItemId[]) {
    if (!environment) return [];
    await queryClient.refetchQueries({ queryKey: queryKeys.devSetupItems });
    const fresh: Record<DevItemId, DevDetection | undefined> = {};
    for (const item of items) {
      fresh[item.id] = queryClient.getQueryData<DevDetection>(queryKeys.devSetupItem(item.id));
    }
    const rebuilt = buildChecklist({ stacks, environment, detections: fresh, jobs });
    return collectConsents(buildInstallPlan(ids, rebuilt.entries, environment.os).steps);
  }

  async function startInstall(ids: readonly DevItemId[], consented: boolean): Promise<void> {
    try {
      await window.agentmat.devSetup.install({ ids: [...ids], consented });
    } catch (error) {
      if (plainMessage(error) !== CONSENT_REQUIRED) {
        toast.error(`Could not start the install. ${plainMessage(error)}`);
        return;
      }
      // Main sees an agreement this page did not, because the machine changed since the last
      // check. Look again and ask with what the fresh list says. If it still shows none, or the
      // agreement was already accepted, there is nothing to ask, so say so without the code.
      const consents = consented ? [] : await consentsAfterRecheck(ids);
      if (consents.length === 0) {
        toast.error('Could not start the install. Refresh the list and try again.');
        return;
      }
      if (await acceptAgreements(consents)) await startInstall(ids, true);
    }
  }

  async function install(ids: readonly DevItemId[]): Promise<void> {
    const steps =
      checklist && environment
        ? buildInstallPlan(ids, checklist.entries, environment.os).steps
        : [];
    const consents = collectConsents(steps);
    if (consents.length > 0 && !(await acceptAgreements(consents))) return;
    await startInstall(ids, consents.length > 0);
  }

  function recheck(id: DevItemId): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.devSetupItem(id) });
  }

  return {
    environment,
    environmentFailed: environmentQuery.isError && !environment,
    retryEnvironment: () => {
      void environmentQuery.refetch();
    },
    stacks,
    toggleStack: (id) => {
      const stack = DEV_STACKS.find((one) => one.id === id);
      // Essentials is always on, and an id from nowhere is not a stack.
      if (!stack || stack.alwaysOn) return;
      const next = stacks.includes(stack.id)
        ? stacks.filter((one) => one !== stack.id)
        : [...stacks, stack.id];
      saveStacks.mutate(normalizeDevSetupStacks(next));
    },
    checklist,
    job,
    plan,
    install,
    installAll: () => install(checklist ? missingItemIds(checklist.entries) : []),
    cancel: (id) => {
      void window.agentmat.devSetup.cancel(id);
    },
    recheck,
    recheckAll: () => {
      // The machine too: a package manager may have been installed since the page opened.
      void queryClient.invalidateQueries({ queryKey: queryKeys.devSetupEnvironment });
      void queryClient.invalidateQueries({ queryKey: queryKeys.devSetupItems });
    },
    openInTerminal: ({ id, name, command }) => {
      // The command is typed in but not run: the person reads it and presses Enter themselves.
      useTerminalStore.getState().openSession({ title: `Install ${name}`, initialInput: command });
      toast.info(`Press Enter in the terminal to install ${name}.`);
      setWaiting((current) => ({ ...current, [id]: Date.now() }));
    },
    copyCommand: async ({ name, command }) => {
      try {
        await navigator.clipboard.writeText(command);
        toast.success(`Copied the command for ${name}.`);
      } catch {
        toast.error('Could not copy. Select the command and copy it by hand.');
      }
    },
    addToPath: async ({ id, name }) => {
      try {
        const { changed, where } = await window.agentmat.devSetup.addToPath(id);
        if (changed) toast.success(`Added ${name} to ${where}. Open a new terminal to use it.`);
        else toast.info(`${name} is already on your PATH.`);
        // The row drops its warning once the fresh check finds the tool on the PATH.
        recheck(id);
      } catch (error) {
        toast.error(`Could not add ${name} to your PATH. ${plainMessage(error)}`);
        // Main looked at the tool just before refusing, so the row may still show the old state.
        recheck(id);
      }
    },
  };
}
