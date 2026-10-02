import { ipcRenderer } from 'electron';
import type {
  DeployAppRegistryChoice,
  DeployGithubCliInput,
  DeployGithubCliStatus,
  DeployGithubTokenCheck,
  DeployGithubTokenInput,
  DeployRegistryCredential,
  DeployRegistryCredentialInput,
  DeployRegistryPlan,
  DeployRegistryPlanInput,
  DeployServerCredential,
  DeployServerCredentialInput,
  DeployServerCredentialRemoveInput,
} from '../shared/deployRegistryTypes';
import { IPC } from '../shared/ipcChannels';

/**
 * Private registries (E08). Secrets only ever go in (a pasted token, a password); nothing here
 * returns one. Storing on a server needs an Admin and a step-up, refused as
 * `[core:stepUpRequired]` until the call carries the password or a code.
 */
export function createDeployRegistry() {
  return {
    list: (): Promise<DeployRegistryCredential[]> => ipcRenderer.invoke(IPC.deployRegistry.list),
    checkGithubToken: (token: string): Promise<DeployGithubTokenCheck> =>
      ipcRenderer.invoke(IPC.deployRegistry.checkGithubToken, token),
    saveGithubToken: (input: DeployGithubTokenInput): Promise<DeployRegistryCredential> =>
      ipcRenderer.invoke(IPC.deployRegistry.saveGithubToken, input),
    githubCliStatus: (): Promise<DeployGithubCliStatus> =>
      ipcRenderer.invoke(IPC.deployRegistry.githubCliStatus),
    saveGithubCli: (input: DeployGithubCliInput): Promise<DeployRegistryCredential> =>
      ipcRenderer.invoke(IPC.deployRegistry.saveGithubCli, input),
    saveCredential: (input: DeployRegistryCredentialInput): Promise<DeployRegistryCredential> =>
      ipcRenderer.invoke(IPC.deployRegistry.saveCredential, input),
    remove: (credentialId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.deployRegistry.remove, credentialId),
    setAppChoice: (input: DeployAppRegistryChoice): Promise<void> =>
      ipcRenderer.invoke(IPC.deployRegistry.setAppChoice, input),
    plan: (input: DeployRegistryPlanInput): Promise<DeployRegistryPlan> =>
      ipcRenderer.invoke(IPC.deployRegistry.plan, input),
    serverList: (serverId: string): Promise<DeployServerCredential[]> =>
      ipcRenderer.invoke(IPC.deployRegistry.serverList, serverId),
    serverSave: (input: DeployServerCredentialInput): Promise<DeployServerCredential> =>
      ipcRenderer.invoke(IPC.deployRegistry.serverSave, input),
    serverRemove: (input: DeployServerCredentialRemoveInput): Promise<void> =>
      ipcRenderer.invoke(IPC.deployRegistry.serverRemove, input),
  };
}
