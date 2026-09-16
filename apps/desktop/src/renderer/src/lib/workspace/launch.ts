import {
  AGENT_TYPE_CLI_ID,
  type AgentHistoryProvider,
  type AgentHistorySession,
  getCliArgsFor,
  getCliDefinition,
  type Project,
  quoteForShell,
  shellKindFor,
  withoutConfiguredRunArgs,
} from '@agentmat/core';
import { toast } from 'sonner';
import { terminalRuntime } from '@/lib/terminal/terminalRuntime';
import { useCliStore } from '@/stores/cliStore';
import { defaultNewSession } from '@/stores/terminalStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export interface ShellOption {
  shell: string;
  label: string;
}

/** The shells main is willing to start on this platform, the default first. */
export function shellOptions(): ShellOption[] {
  const platform = window.agentmat.platform;
  if (platform === 'win32') {
    return [
      { shell: 'powershell.exe', label: 'PowerShell' },
      { shell: 'pwsh.exe', label: 'PowerShell 7' },
      { shell: 'cmd.exe', label: 'Command Prompt' },
    ];
  }
  const all: ShellOption[] = [
    { shell: 'zsh', label: 'zsh' },
    { shell: 'bash', label: 'bash' },
    { shell: 'fish', label: 'fish' },
  ];
  const first = defaultNewSession().shell;
  return [...all.filter((o) => o.shell === first), ...all.filter((o) => o.shell !== first)];
}

/** The agent a project works with: its own pick, else the app default, else its agent type's CLI. */
export function projectCliId(project: Project): string | null {
  return (
    project.cliId ?? useCliStore.getState().defaultCliId ?? AGENT_TYPE_CLI_ID[project.agentType]
  );
}

/** Settings files that make a CLI report its status through hooks, fetched ahead of launch. */
const statusHookSettings = new Map<string, string | null>();

/**
 * Looks up, once per CLI, whether its launches can carry status hooks. Called at startup so
 * a launch never has to wait on it.
 */
export function prepareStatusHooks(cliIds: string[]): void {
  for (const cliId of cliIds) {
    if (statusHookSettings.has(cliId)) continue;
    statusHookSettings.set(cliId, null);
    void window.agentmat.agents
      .statusHookSettings(cliId)
      .then((path) => statusHookSettings.set(cliId, path))
      .catch(() => undefined);
  }
}

/**
 * The command a workspace tab types to start a CLI: status hooks when available, the user's
 * configured arguments, then any run arguments (a suggested model and effort) the user's own
 * arguments don't already set.
 */
function agentCommand(
  cliId: string,
  shell: string | undefined,
  runArgs: string[] = [],
  leadingArgs: string[] = [],
): string | null {
  const cli = getCliDefinition(cliId);
  if (!cli) return null;
  const kind = shellKindFor(shell, window.agentmat.platform);
  const hookSettings = statusHookSettings.get(cliId);
  const configured = getCliArgsFor(useCliStore.getState().cliArgs, cliId);
  const extra = withoutConfiguredRunArgs(configured, runArgs).map((arg) =>
    quoteForShell(arg, kind),
  );
  return [
    cli.executableNames[0],
    ...leadingArgs.map((arg) => quoteForShell(arg, kind)),
    ...(hookSettings ? ['--settings', quoteForShell(hookSettings, kind)] : []),
    configured,
    ...extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export interface PromptLaunch {
  cliId: string;
  prompt: string;
  /** Model and effort flags for this CLI, e.g. from the prompt's run recommendation. */
  runArgs?: string[];
  /** Shown on the tab, e.g. "Opus 5 · High". */
  runLabel?: string;
}

/**
 * Opens an agent tab and starts the CLI right away, with the model and effort it was given.
 * The prompt is not part of the command: it is pasted into the CLI's own input box once the CLI
 * has finished starting, exactly as if the user had pasted it, and left unsubmitted so they read
 * it over and press Enter.
 */
export function launchPromptTab(
  project: Project,
  launch: PromptLaunch,
  groupId?: string,
): string | null {
  const cli = getCliDefinition(launch.cliId);
  const shell = defaultNewSession().shell;
  const command = agentCommand(launch.cliId, shell, launch.runArgs);
  if (!cli || !command) {
    toast.error('Unknown CLI.');
    return null;
  }
  const store = useWorkspaceStore.getState();
  store.openProject(project.id);
  const tabId = store.addTerminal(
    project.id,
    {
      title: cli.name,
      cliId: launch.cliId,
      shell,
      cwd: project.folderPath,
      launchInput: `${command}\r`,
      runLabel: launch.runLabel,
    },
    groupId,
  );
  // Nothing is typed into a shell that never got the CLI up: the prompt would run as commands.
  // It goes to the clipboard instead, so the user can paste it once they have sorted the CLI out.
  void terminalRuntime.deliverPrompt(tabId, launch.prompt).then((delivered) => {
    if (delivered) return;
    void navigator.clipboard.writeText(launch.prompt);
    toast.warning(`${cli.name} did not come up`, {
      description: 'The prompt is on your clipboard, ready to paste once the CLI is running.',
    });
  });
  return tabId;
}

/** Opens a tab in the project's workspace that starts an agent CLI. Returns the tab id. */
export function launchAgentTab(project: Project, cliId: string, groupId?: string): string | null {
  const cli = getCliDefinition(cliId);
  const shell = defaultNewSession().shell;
  const command = agentCommand(cliId, shell);
  if (!cli || !command) {
    toast.error('Unknown CLI.');
    return null;
  }
  const store = useWorkspaceStore.getState();
  store.openProject(project.id);
  return store.addTerminal(
    project.id,
    {
      title: cli.name,
      cliId,
      shell,
      cwd: project.folderPath,
      launchInput: `${command}\r`,
    },
    groupId,
  );
}

/** The CLI that owns each kind of saved conversation. */
export const HISTORY_CLI_ID: Record<AgentHistoryProvider, string> = {
  'claude-code': 'claude-code',
  codex: 'codex-cli',
};

/**
 * Opens a tab that picks a past conversation back up: `claude --resume <id>` or
 * `codex resume <id>`, with the user's usual arguments.
 */
export function launchResumeTab(
  project: Project,
  session: Pick<AgentHistorySession, 'provider' | 'id' | 'title' | 'firstPrompt'>,
  groupId?: string,
): string | null {
  const cliId = HISTORY_CLI_ID[session.provider];
  const cli = getCliDefinition(cliId);
  const shell = defaultNewSession().shell;
  const command =
    session.provider === 'codex'
      ? agentCommand(cliId, shell, [], ['resume', session.id])
      : agentCommand(cliId, shell, ['--resume', session.id]);
  if (!cli || !command) {
    toast.error('Unknown CLI.');
    return null;
  }
  const label = session.title ?? session.firstPrompt;
  const store = useWorkspaceStore.getState();
  store.openProject(project.id);
  return store.addTerminal(
    project.id,
    {
      title: cli.name,
      cliId,
      shell,
      cwd: project.folderPath,
      launchInput: `${command}\r`,
      runLabel: label
        ? `Resumed: ${label.length > 60 ? `${label.slice(0, 59)}…` : label}`
        : undefined,
    },
    groupId,
  );
}

/** Opens a plain shell tab in the project folder. Returns the tab id. */
export function launchShellTab(project: Project, shell?: string, groupId?: string): string {
  const option = shellOptions().find((o) => o.shell === shell) ?? {
    shell: defaultNewSession().shell ?? '',
    label: defaultNewSession().title,
  };
  const store = useWorkspaceStore.getState();
  store.openProject(project.id);
  return store.addTerminal(
    project.id,
    { title: option.label, shell: option.shell || undefined, cwd: project.folderPath },
    groupId,
  );
}
