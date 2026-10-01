import { lookup } from 'node:dns/promises';
import { join } from 'node:path';
import { app, ipcMain } from 'electron';
import { registerCloudflareHandlers } from '../../ipc/cloudflare';
import { getMainWindow } from '../../mainWindow';
import {
  decryptSecret,
  encryptSecret,
  isLockedEnvelope,
  registerSealedSecretStore,
} from '../../ssh/vault';
import { store } from '../../store';
import { addressesOfHost, type ServerAddresses } from './pointDomain';
import { CloudflareService } from './service';
import { CloudflareState, cloudflareFilePort } from './state';

/**
 * Wires the Cloudflare page into Electron. The token is sealed with the Servers vault, so it moves
 * with a passkey change like the Deploy device keys. "Point domain to this server" takes a saved
 * server's addresses from its host for now; once the server core reports its public addresses,
 * this is the one place to swap the source.
 */

async function savedServerAddresses(serverId: string): Promise<ServerAddresses> {
  const server = (await store.getSshServers()).find((candidate) => candidate.id === serverId);
  if (!server) throw new Error('This saved server no longer exists.');
  return addressesOfHost(server.host, (host) => lookup(host, { all: true, verbatim: true }));
}

export function registerCloudflareIpc(): void {
  const state = new CloudflareState(
    cloudflareFilePort(join(app.getPath('userData'), 'data', 'cloudflare.json')),
  );
  registerSealedSecretStore(state.sealedKeys);
  const service = new CloudflareService({
    state,
    seal: encryptSecret,
    unseal: decryptSecret,
    isLocked: isLockedEnvelope,
    addresses: savedServerAddresses,
  });
  registerCloudflareHandlers({
    ipc: ipcMain,
    service,
    guard: (event) => {
      const win = getMainWindow();
      return (
        !!win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame
      );
    },
  });
}
