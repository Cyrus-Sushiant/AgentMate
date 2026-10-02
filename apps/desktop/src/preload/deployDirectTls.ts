import { ipcRenderer } from 'electron';
import type {
  DeployDirectTlsEnableInput,
  DeployDirectTlsInfo,
} from '../shared/deployDirectTlsTypes';
import { IPC } from '../shared/ipcChannels';

/**
 * Direct TLS (E16), for the server's Security section. Turning it on may need a step-up
 * (`[core:stepUpRequired]`): pass the password or a code, as the Firewall does. A role below
 * Owner comes back as `[core:forbidden]`.
 */
export function createDeployDirectTls() {
  return {
    status: (serverId: string): Promise<DeployDirectTlsInfo> =>
      ipcRenderer.invoke(IPC.deployDirectTls.status, serverId),
    enable: (input: DeployDirectTlsEnableInput): Promise<DeployDirectTlsInfo> =>
      ipcRenderer.invoke(IPC.deployDirectTls.enable, input),
    disable: (serverId: string): Promise<DeployDirectTlsInfo> =>
      ipcRenderer.invoke(IPC.deployDirectTls.disable, serverId),
    acceptPin: (serverId: string): Promise<DeployDirectTlsInfo> =>
      ipcRenderer.invoke(IPC.deployDirectTls.acceptPin, serverId),
  };
}
