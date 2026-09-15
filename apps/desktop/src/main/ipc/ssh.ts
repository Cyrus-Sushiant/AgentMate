import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dialog, type IpcMainInvokeEvent, ipcMain, type WebContents } from 'electron';
import type {
  CreateSshSessionOptions,
  SaveSshServerInput,
  SshAttachResult,
  SshSavedServer,
  SshVaultStatus,
  StoredSshServer,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { keepAwake } from '../power/keepAwake';
import { SshSessionManager } from '../ssh/sessionManager';
import {
  decryptSecret,
  encryptSecret,
  getVaultStatus,
  setPasskey,
  unlockVault,
} from '../ssh/vault';
import { store } from '../store';

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const manager = new SshSessionManager();
/** The session id -> saved server it belongs to, for the last-connected/host-key writebacks. */
const sessions = new Map<string, { serverId: string }>();
/** The window currently showing each session. Output goes there. */
const owners = new Map<string, WebContents>();

function syncPowerSaveBlocker(): void {
  keepAwake.setBusy('ssh', sessions.size > 0);
}

function forwardData(sessionId: string, data: string): void {
  const owner = owners.get(sessionId);
  if (owner && !owner.isDestroyed()) owner.send(IPC.ssh.onData, { sessionId, data });
}

function forwardExit(sessionId: string, error?: string): void {
  const owner = owners.get(sessionId);
  if (owner && !owner.isDestroyed()) owner.send(IPC.ssh.onExit, { sessionId, error });
  owners.delete(sessionId);
  sessions.delete(sessionId);
  syncPowerSaveBlocker();
}

function toPublicServer(server: StoredSshServer): SshSavedServer {
  const { secretEnvelope: _secretEnvelope, ...rest } = server;
  return { ...rest, hasSecret: server.secretEnvelope != null };
}

/**
 * Serializes read-modify-write updates to ssh-servers.json. A connect can trigger two of these
 * close together (the host-key-trust write from `onHostKeyTrusted`, then the lastConnectedAt
 * write once the shell opens); without a queue their reads can interleave and one write silently
 * loses the other's change.
 */
let updateQueue: Promise<void> = Promise.resolve();

function updateServer(
  id: string,
  update: (server: StoredSshServer) => StoredSshServer,
): Promise<void> {
  const next = updateQueue.then(async () => {
    const servers = await store.getSshServers();
    const index = servers.findIndex((s) => s.id === id);
    if (index < 0) return;
    const updated = [...servers];
    updated[index] = update(updated[index]);
    await store.setSshServers(updated);
  });
  updateQueue = next.catch(() => undefined);
  return next;
}

export function registerSshHandlers(): void {
  ipcMain.handle(
    IPC.ssh.listServers,
    async (): Promise<SshSavedServer[]> => (await store.getSshServers()).map(toPublicServer),
  );

  ipcMain.handle(
    IPC.ssh.saveServer,
    async (_event, input: SaveSshServerInput): Promise<SshSavedServer> => {
      const servers = await store.getSshServers();
      const index = input.id ? servers.findIndex((s) => s.id === input.id) : -1;
      const existing = index >= 0 ? servers[index] : undefined;

      // A stored secret means something different under each auth method (a login password vs.
      // a key passphrase), so switching methods without typing a new one drops it rather than
      // silently reusing the old value for the new meaning.
      const secretEnvelope = input.secret
        ? await encryptSecret(input.secret)
        : existing && existing.authMethod === input.authMethod
          ? existing.secretEnvelope
          : undefined;
      // The trusted host key is only meaningful for the endpoint it was recorded against.
      const hostChanged =
        existing && (existing.host !== input.host || existing.port !== input.port);

      const record: StoredSshServer = {
        id: existing?.id ?? randomUUID(),
        nickname: input.nickname,
        host: input.host,
        port: input.port,
        username: input.username,
        authMethod: input.authMethod,
        privateKeyPath: input.authMethod === 'privateKey' ? input.privateKeyPath : undefined,
        secretEnvelope,
        hostKeyFingerprint: hostChanged ? undefined : existing?.hostKeyFingerprint,
        createdAt: existing?.createdAt ?? Date.now(),
        lastConnectedAt: existing?.lastConnectedAt ?? null,
      };

      const next = [...servers];
      if (index >= 0) next[index] = record;
      else next.push(record);
      await store.setSshServers(next);
      return toPublicServer(record);
    },
  );

  ipcMain.handle(IPC.ssh.removeServer, async (_event, id: string): Promise<void> => {
    for (const [sessionId, info] of sessions) {
      if (info.serverId === id) manager.kill(sessionId);
    }
    const servers = await store.getSshServers();
    await store.setSshServers(servers.filter((s) => s.id !== id));
  });

  ipcMain.handle(IPC.ssh.pickPrivateKeyFile, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a private key',
      defaultPath: join(homedir(), '.ssh'),
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.ssh.vaultStatus, (): Promise<SshVaultStatus> => getVaultStatus());

  ipcMain.handle(
    IPC.ssh.unlockVault,
    (_event, passphrase: string): Promise<boolean> => unlockVault(passphrase),
  );

  ipcMain.handle(
    IPC.ssh.setPasskey,
    (_event, passphrase: string | null): Promise<{ ok: boolean; error?: string }> =>
      setPasskey(passphrase),
  );

  ipcMain.handle(
    IPC.ssh.create,
    async (
      event: IpcMainInvokeEvent,
      options: CreateSshSessionOptions,
    ): Promise<SshAttachResult> => {
      const sessionId =
        options.sessionId && SESSION_ID_PATTERN.test(options.sessionId)
          ? options.sessionId
          : randomUUID();

      const servers = await store.getSshServers();
      const server = servers.find((s) => s.id === options.savedServerId);
      if (!server) throw new Error('This saved server no longer exists.');

      owners.set(sessionId, event.sender);

      let password: string | undefined;
      let passphrase: string | undefined;
      if (server.secretEnvelope) {
        const secret = await decryptSecret(server.secretEnvelope);
        if (server.authMethod === 'password') password = secret;
        else passphrase = secret;
      }

      try {
        await manager.create(
          sessionId,
          {
            host: server.host,
            port: server.port,
            username: server.username,
            authMethod: server.authMethod,
            password,
            privateKeyPath: server.privateKeyPath,
            passphrase,
            storedFingerprint: server.hostKeyFingerprint,
            cols: options.cols,
            rows: options.rows,
          },
          {
            onData: forwardData,
            onExit: forwardExit,
            onHostKeyTrusted: (_id, fingerprint) => {
              void updateServer(server.id, (s) => ({ ...s, hostKeyFingerprint: fingerprint }));
            },
          },
        );
      } catch (error) {
        owners.delete(sessionId);
        throw error;
      }

      sessions.set(sessionId, { serverId: server.id });
      syncPowerSaveBlocker();
      void updateServer(server.id, (s) => ({ ...s, lastConnectedAt: Date.now() }));
      return { sessionId };
    },
  );

  ipcMain.handle(IPC.ssh.write, (_event, sessionId: string, data: string): void => {
    manager.write(sessionId, data);
  });

  ipcMain.handle(IPC.ssh.resize, (_event, sessionId: string, cols: number, rows: number): void => {
    manager.resize(sessionId, cols, rows);
  });

  ipcMain.handle(IPC.ssh.kill, (_event, sessionId: string): void => {
    manager.kill(sessionId);
    owners.delete(sessionId);
    sessions.delete(sessionId);
    syncPowerSaveBlocker();
  });
}

/** Called from `before-quit`; SSH sessions never outlive the app (no host process for them). */
export function killAllSshSessions(): void {
  manager.killAll();
  sessions.clear();
  owners.clear();
  syncPowerSaveBlocker();
}
