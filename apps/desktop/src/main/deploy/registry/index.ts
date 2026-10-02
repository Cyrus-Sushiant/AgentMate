import { join } from 'node:path';
import { app, type IpcMainInvokeEvent, ipcMain } from 'electron';
import { runGh } from '../../git/githubCli';
import { registerDeployRegistryHandlers } from '../../ipc/deployRegistry';
import {
  decryptSecret,
  encryptSecret,
  isLockedEnvelope,
  registerSealedSecretStore,
} from '../../ssh/vault';
import type { CoreCallDeps } from '../coreCalls';
import type { DeployStacks } from '../stacks/service';
import { planFor } from './plan';
import { DeployServerRegistries } from './serverCredentials';
import { DeployRegistries } from './service';
import { RegistryState, registryFilePort } from './state';

/**
 * Wires private registries (E08) into Electron. The sign-ins are sealed with the Servers vault,
 * so they move with a passkey change like the Cloudflare token and the Deploy device keys. The
 * GitHub CLI is the one `runGh` runs for the rest of the app.
 */

export function createDeployRegistries(): DeployRegistries {
  const state = new RegistryState(
    registryFilePort(join(app.getPath('userData'), 'data', 'registries.json')),
  );
  registerSealedSecretStore(state.sealedKeys);
  return new DeployRegistries({
    state,
    seal: encryptSecret,
    unseal: decryptSecret,
    isLocked: isLockedEnvelope,
    gh: (args) => runGh(args, { readOnly: true }),
  });
}

export function registerDeployRegistryIpc(deps: {
  registries: DeployRegistries;
  core: CoreCallDeps;
  stacks: Pick<DeployStacks, 'registriesOf'>;
  guard: (event: IpcMainInvokeEvent) => boolean;
}): void {
  const servers = new DeployServerRegistries({ ...deps.core, local: deps.registries });
  registerDeployRegistryHandlers({
    ipc: ipcMain,
    registries: deps.registries,
    servers,
    plan: (request) => planFor(request, deps.registries, servers, deps.stacks),
    guard: deps.guard,
  });
}
