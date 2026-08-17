import { getCliArgsFor, getCliDefinition } from '@agentmat/core';
import { toast } from 'sonner';
import { useCliStore } from '@/stores/cliStore';
import { useTerminalStore } from '@/stores/terminalStore';

/**
 * The command that starts this CLI, with the user's configured arguments already
 * attached ("claude --model sonnet"). Callers that pass a prompt of their own append
 * it after this, so the flags stay ahead of the prompt.
 */
export function cliLaunchCommand(cliId: string): string | null {
  const cli = getCliDefinition(cliId);
  if (!cli) return null;
  const args = getCliArgsFor(useCliStore.getState().cliArgs, cliId);
  return args ? `${cli.executableNames[0]} ${args}` : cli.executableNames[0];
}

/** Opens a terminal session that starts this CLI so the user can work in it. */
export function openCliInTerminal(options: {
  cliId: string;
  cwd?: string;
  projectId?: string;
}): boolean {
  const cli = getCliDefinition(options.cliId);
  const command = cliLaunchCommand(options.cliId);
  if (!cli || !command) {
    toast.error('Unknown CLI.');
    return false;
  }
  useTerminalStore.getState().openSession({
    title: cli.name,
    cwd: options.cwd,
    projectId: options.projectId,
    initialInput: `${command}\r`,
  });
  return true;
}
