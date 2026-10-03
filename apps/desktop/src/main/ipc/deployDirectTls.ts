import type { IpcMainInvokeEvent } from 'electron';
import { checkDirectTlsPort, checkSources } from '../../shared/deploy/directTlsValidation';
import type { DeployDirectTlsEnableInput } from '../../shared/deployDirectTlsTypes';
import { IPC } from '../../shared/ipcChannels';
import type { DeployDirectTls } from '../deploy/directTls/service';
import { type DeployIpcRegistry, object, serverId, stepUpInput } from './deploy';

/**
 * Direct TLS channels (E16): how the mode stands, turning it on and off, and taking a new pin.
 * Main window only, every argument checked here; the core checks the port and sources again and
 * decides who may change them.
 */

export interface DeployDirectTlsHandlerDeps {
  ipc: DeployIpcRegistry;
  directTls: Pick<DeployDirectTls, 'status' | 'enable' | 'disable' | 'acceptPin'>;
  /** True only for the main window's own frame. */
  guard: (event: IpcMainInvokeEvent) => boolean;
}

export function enableInput(value: unknown): DeployDirectTlsEnableInput {
  const input = object(value, 'direct TLS settings');
  const proof = stepUpInput(value);
  const port = typeof input.port === 'number' ? checkDirectTlsPort(input.port) : null;
  if (!port?.ok) throw new Error(port?.reason ?? 'The port is a number, such as 7443.');
  if (!Array.isArray(input.sources) || input.sources.some((item) => typeof item !== 'string')) {
    throw new Error('The sources must be a list of addresses or networks.');
  }
  const sources = checkSources(input.sources as string[]);
  if (!sources.ok) throw new Error(sources.reason);
  return { ...proof, port: port.value, sources: sources.value };
}

export function registerDeployDirectTlsHandlers(deps: DeployDirectTlsHandlerDeps): void {
  const { ipc, directTls } = deps;
  const handle = (channel: string, run: (...args: unknown[]) => unknown) => {
    ipc.handle(channel, async (event, ...args) => {
      if (!deps.guard(event)) throw new Error('Deploy is only available in the main window.');
      return run(...args);
    });
  };

  handle(IPC.deployDirectTls.status, (id) => directTls.status(serverId(id)));
  handle(IPC.deployDirectTls.enable, (value) => directTls.enable(enableInput(value)));
  handle(IPC.deployDirectTls.disable, (id) => directTls.disable(serverId(id)));
  handle(IPC.deployDirectTls.acceptPin, (id) => directTls.acceptPin(serverId(id)));
}
