import type { IpcMainInvokeEvent } from 'electron';
import type { DeployInstallInput, DeployUninstallInput } from '../../shared/deployTypes';
import { IPC } from '../../shared/ipcChannels';
import type { DeployService } from '../deploy/service';

/**
 * The Deploy section's invoke channels. They answer only the app's main window: browser tabs,
 * webviews and widgets share the preload, and none of them may reach a server's root shell.
 * Every argument is checked here before the service sees it.
 */

export interface DeployIpcRegistry {
  handle(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
  ): void;
}

export interface DeployHandlerDeps {
  ipc: DeployIpcRegistry;
  service: DeployService;
  /** True only for the main window's own frame. */
  guard: (event: IpcMainInvokeEvent) => boolean;
}

const SERVER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_PASSWORD = 1024;

function serverId(value: unknown): string {
  if (typeof value !== 'string' || !SERVER_ID.test(value)) {
    throw new Error('That is not a saved server.');
  }
  return value;
}

function sudoPassword(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > MAX_PASSWORD) {
    throw new Error('The sudo password must be text.');
  }
  return value;
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error('Expected install options.');
  return value as Record<string, unknown>;
}

function installInput(value: unknown): DeployInstallInput {
  const input = object(value);
  return { serverId: serverId(input.serverId), sudoPassword: sudoPassword(input.sudoPassword) };
}

function uninstallInput(value: unknown): DeployUninstallInput {
  const input = object(value);
  if (typeof input.keepData !== 'boolean') throw new Error('Say whether to keep the data.');
  return { ...installInput(input), keepData: input.keepData };
}

export function registerDeployHandlers({ ipc, service, guard }: DeployHandlerDeps): void {
  const handle = (channel: string, run: (...args: unknown[]) => unknown) => {
    ipc.handle(channel, async (event, ...args) => {
      if (!guard(event)) throw new Error('Deploy is only available in the main window.');
      return run(...args);
    });
  };

  handle(IPC.deploy.listServers, () => service.listServers());
  handle(IPC.deploy.preflight, (id) => service.preflight(serverId(id)));
  handle(IPC.deploy.install, (input) => service.install(installInput(input)));
  handle(IPC.deploy.uninstall, (input) => service.uninstall(uninstallInput(input)));
  handle(IPC.deploy.health, (id) => service.health(serverId(id)));
}
