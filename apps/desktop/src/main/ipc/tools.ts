import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ipcMain } from 'electron';
import {
  AGENT_TOOL_REGISTRY,
  getAgentToolDefinition,
  getDockerResetCommand,
  getDockerStartCommand,
  getDockerStopCommand,
  getToolInstallCommandForCurrentOS,
} from '@agentmat/core';
import type { AgentToolDefinition, InstalledAgentTool, SupportedOS } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';

const execFileAsync = promisify(execFile);
const DETECT_TIMEOUT_MS = 8000;

async function runProbe(command: string, args: string[]): Promise<string | null> {
  try {
    // See cliDetection.ts: npm-installed CLIs are .cmd shims on Windows, which Node
    // refuses to spawn directly, so route through cmd.exe with a static argv array.
    const { stdout } =
      process.platform === 'win32'
        ? await execFileAsync('cmd.exe', ['/d', '/s', '/c', command, ...args], {
            timeout: DETECT_TIMEOUT_MS,
            windowsHide: true,
          })
        : await execFileAsync(command, args, { timeout: DETECT_TIMEOUT_MS, windowsHide: true });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function detectDockerStatus(
  tool: AgentToolDefinition,
): Promise<InstalledAgentTool['dockerStatus']> {
  if (!tool.docker) return 'unavailable';
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['inspect', '-f', '{{.State.Running}}', tool.docker.containerName],
      { timeout: DETECT_TIMEOUT_MS, windowsHide: true },
    );
    return stdout.trim() === 'true' ? 'running' : 'stopped';
  } catch {
    return 'not-created';
  }
}

async function detectTool(tool: AgentToolDefinition): Promise<InstalledAgentTool> {
  const [versionOutput, dockerStatus] = await Promise.all([
    tool.detectCommand ? runProbe(tool.detectCommand.command, tool.detectCommand.args) : Promise.resolve(null),
    detectDockerStatus(tool),
  ]);
  const versionMatch = versionOutput?.match(/\d+\.\d+\.\d+[\w.-]*/);
  return {
    id: tool.id,
    installed: versionOutput !== null,
    version: versionMatch ? versionMatch[0] : (versionOutput?.slice(0, 40) ?? null),
    dockerStatus,
    lastCheckedAt: new Date().toISOString(),
  };
}

export function registerToolHandlers(): void {
  ipcMain.handle(IPC.tools.detectAll, async (): Promise<InstalledAgentTool[]> => {
    return Promise.all(AGENT_TOOL_REGISTRY.map((tool) => detectTool(tool)));
  });

  ipcMain.handle(IPC.tools.getInstallCommand, (_event, toolId: string): string | null => {
    const tool = getAgentToolDefinition(toolId);
    if (!tool) return null;
    return getToolInstallCommandForCurrentOS(tool, process.platform as SupportedOS);
  });

  ipcMain.handle(
    IPC.tools.getDockerCommand,
    (_event, toolId: string, action: 'start' | 'stop' | 'reset'): string | null => {
      const tool = getAgentToolDefinition(toolId);
      if (!tool) return null;
      if (action === 'start') return getDockerStartCommand(tool);
      if (action === 'stop') return getDockerStopCommand(tool);
      return getDockerResetCommand(tool);
    },
  );
}
