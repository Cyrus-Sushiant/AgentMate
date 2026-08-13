import { getCliDefinition } from '@agentmat/core';
import { toast } from 'sonner';
import { useTerminalStore } from '@/stores/terminalStore';

/** Opens a terminal session that starts this CLI so the user can work in it. */
export function openCliInTerminal(options: {
  cliId: string;
  cwd?: string;
  projectId?: string;
}): boolean {
  const cli = getCliDefinition(options.cliId);
  if (!cli) {
    toast.error('Unknown CLI.');
    return false;
  }
  const executable = cli.executableNames[0];
  useTerminalStore.getState().openSession({
    title: cli.name,
    cwd: options.cwd,
    projectId: options.projectId,
    initialInput: `${executable}\r`,
  });
  return true;
}
