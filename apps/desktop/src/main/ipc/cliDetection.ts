import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ipcMain } from 'electron';
import { CLI_REGISTRY, getCliDefinition, getInstallCommandForCurrentOS } from '@agentmat/core';
import type { CliDefinition, InstalledCli, SupportedOS } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';

const execFileAsync = promisify(execFile);

async function detectCli(cli: CliDefinition): Promise<InstalledCli> {
  try {
    // npm-installed global CLIs are typically .cmd shims on Windows, which
    // Node refuses to spawn directly (security fix in Node >=18.20/20.11/21.6).
    // Route through cmd.exe explicitly (argv array, not `shell: true`) so
    // Node doesn't naively string-concatenate args — command/args here are
    // always static, developer-authored registry entries, never renderer input.
    const { stdout } =
      process.platform === 'win32'
        ? await execFileAsync(
            'cmd.exe',
            ['/d', '/s', '/c', cli.versionCommand.command, ...cli.versionCommand.args],
            { timeout: 8000, windowsHide: true },
          )
        : await execFileAsync(cli.versionCommand.command, cli.versionCommand.args, {
            timeout: 8000,
            windowsHide: true,
          });
    const versionMatch = stdout.match(/\d+\.\d+\.\d+[\w.-]*/);
    return {
      id: cli.id,
      installed: true,
      version: versionMatch ? versionMatch[0] : stdout.trim().slice(0, 40) || null,
      executablePath: null,
      lastCheckedAt: new Date().toISOString(),
    };
  } catch {
    return {
      id: cli.id,
      installed: false,
      version: null,
      executablePath: null,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}

export function registerCliDetectionHandlers(): void {
  ipcMain.handle(IPC.cli.detectAll, async (): Promise<InstalledCli[]> => {
    return Promise.all(CLI_REGISTRY.map((cli) => detectCli(cli)));
  });

  ipcMain.handle(IPC.cli.getInstallCommand, (_event, cliId: string): string | null => {
    const cli = getCliDefinition(cliId);
    if (!cli) return null;
    return getInstallCommandForCurrentOS(cli, process.platform as SupportedOS);
  });
}
