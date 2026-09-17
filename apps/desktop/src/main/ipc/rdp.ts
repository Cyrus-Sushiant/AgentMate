import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { app, dialog, type IpcMainInvokeEvent, ipcMain, shell, type WebContents } from 'electron';
import type {
  RdpCertificatePrompt,
  RdpClipboardFiles,
  RdpConnectTicket,
  RdpDownloadTarget,
  RdpSavedServer,
  SaveRdpServerInput,
  StoredRdpServer,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { withRdpDefaults } from '../../shared/rdpDefaults';
import { keepAwake } from '../power/keepAwake';
import { type ClipboardFileSet, readClipboardFiles } from '../rdp/clipboardFiles';
import {
  abandonDownloads,
  beginDownload,
  downloadFolder,
  finishFile,
  prepareEntry,
  writeChunk,
} from '../rdp/downloads';
import { type RdpCertificateInfo, RdpProxy, type RdpProxyTarget } from '../rdp/proxy';
import { formatDestination } from '../rdp/rdcleanpath';
import { closeAllRdpWindows, openRdpWindow } from '../rdp/sessionWindows';
import { decryptSecret, encryptSecret, getVaultStatus } from '../ssh/vault';
import { store } from '../store';

interface RdpSession {
  sessionId: string;
  serverId: string;
  owner: WebContents;
  /** Files copied on this computer that the server may ask to paste, by entry index. */
  clipboard: ClipboardFileSet | null;
  /** A changed certificate waiting for the user's decision. */
  pendingCertificate: RdpCertificateInfo | null;
}

const sessions = new Map<string, RdpSession>();

function toPublicServer(server: StoredRdpServer): RdpSavedServer {
  const { secretEnvelope: _secretEnvelope, ...rest } = server;
  return {
    ...rest,
    options: withRdpDefaults(rest.options),
    hasSecret: server.secretEnvelope != null,
  };
}

/** Same reasoning as the SSH handlers: a connect writes twice in quick succession. */
let updateQueue: Promise<void> = Promise.resolve();

function updateServer(
  id: string,
  update: (server: StoredRdpServer) => StoredRdpServer,
): Promise<void> {
  const next = updateQueue.then(async () => {
    const servers = await store.getRdpServers();
    const index = servers.findIndex((s) => s.id === id);
    if (index < 0) return;
    const updated = [...servers];
    updated[index] = update(updated[index]);
    await store.setRdpServers(updated);
  });
  updateQueue = next.catch(() => undefined);
  return next;
}

function sessionFor(event: IpcMainInvokeEvent, sessionId: string): RdpSession {
  const session = sessions.get(sessionId);
  if (!session || session.owner !== event.sender) throw new Error('This session has ended.');
  return session;
}

function send(session: RdpSession, channel: string, payload: unknown): void {
  if (!session.owner.isDestroyed()) session.owner.send(channel, payload);
}

const proxy = new RdpProxy({
  onCertificateFirstSeen: (target, cert) => {
    const session = sessions.get(target.sessionId);
    if (session)
      void updateServer(session.serverId, (s) => ({ ...s, certFingerprint: cert.fingerprint }));
  },
  onCertificateMismatch: (target, cert) => {
    const session = sessions.get(target.sessionId);
    if (!session) return;
    session.pendingCertificate = cert;
    const prompt: RdpCertificatePrompt = {
      sessionId: session.sessionId,
      host: target.host,
      expectedFingerprint: target.expectedFingerprint ?? '',
      actualFingerprint: cert.fingerprint,
      subject: cert.subject,
      issuer: cert.issuer,
      validTo: cert.validTo,
    };
    send(session, IPC.rdp.onCertificatePrompt, prompt);
  },
  onConnected: (target) => {
    const session = sessions.get(target.sessionId);
    if (session)
      void updateServer(session.serverId, (s) => ({ ...s, lastConnectedAt: Date.now() }));
  },
  onError: (target, message) => {
    const session = sessions.get(target.sessionId);
    if (session) send(session, IPC.rdp.onProxyError, { sessionId: session.sessionId, message });
  },
});

function syncPowerSaveBlocker(): void {
  keepAwake.setBusy('rdp', sessions.size > 0);
}

export function registerRdpHandlers(): void {
  ipcMain.handle(
    IPC.rdp.listServers,
    async (): Promise<RdpSavedServer[]> => (await store.getRdpServers()).map(toPublicServer),
  );

  ipcMain.handle(
    IPC.rdp.saveServer,
    async (_event, input: SaveRdpServerInput): Promise<RdpSavedServer> => {
      const servers = await store.getRdpServers();
      const index = input.id ? servers.findIndex((s) => s.id === input.id) : -1;
      const existing = index >= 0 ? servers[index] : undefined;
      // A pinned certificate only means something for the endpoint it was seen on.
      const endpointChanged =
        existing && (existing.host !== input.host || existing.port !== input.port);

      const record: StoredRdpServer = {
        id: existing?.id ?? randomUUID(),
        nickname: input.nickname,
        host: input.host,
        port: input.port,
        username: input.username,
        domain: input.domain || undefined,
        secretEnvelope: input.secret ? await encryptSecret(input.secret) : existing?.secretEnvelope,
        certFingerprint: endpointChanged ? undefined : existing?.certFingerprint,
        options: withRdpDefaults(input.options),
        createdAt: existing?.createdAt ?? Date.now(),
        lastConnectedAt: existing?.lastConnectedAt ?? null,
      };

      const next = [...servers];
      if (index >= 0) next[index] = record;
      else next.push(record);
      await store.setRdpServers(next);
      return toPublicServer(record);
    },
  );

  ipcMain.handle(IPC.rdp.removeServer, async (_event, id: string): Promise<void> => {
    const servers = await store.getRdpServers();
    await store.setRdpServers(servers.filter((s) => s.id !== id));
  });

  ipcMain.handle(IPC.rdp.openSession, async (_event, serverId: string): Promise<string> => {
    const server = (await store.getRdpServers()).find((s) => s.id === serverId);
    if (!server) throw new Error('This saved server no longer exists.');
    if (server.secretEnvelope?.mode === 'passphrase' && !(await getVaultStatus()).unlocked) {
      throw new Error('The vault is locked. Unlock it with your passkey first.');
    }

    const sessionId = randomUUID();
    let ownerId = -1;
    const window = openRdpWindow({
      sessionId,
      title: `${server.nickname} - Remote Desktop`,
      fullScreen: withRdpDefaults(server.options).fullscreenOnConnect,
      onClosed: () => {
        sessions.delete(sessionId);
        proxy.closeSession(sessionId);
        void abandonDownloads(ownerId);
        syncPowerSaveBlocker();
      },
    });
    ownerId = window.webContents.id;
    const session: RdpSession = {
      sessionId,
      serverId,
      owner: window.webContents,
      clipboard: null,
      pendingCertificate: null,
    };
    sessions.set(sessionId, session);
    syncPowerSaveBlocker();
    return sessionId;
  });

  // Asked again for every connection attempt, so a reconnect gets a fresh one-time proxy URL
  // and the latest saved details (a password changed or a certificate trusted in between).
  ipcMain.handle(IPC.rdp.getTicket, async (event, sessionId: string): Promise<RdpConnectTicket> => {
    const session = sessionFor(event, sessionId);
    const server = (await store.getRdpServers()).find((s) => s.id === session.serverId);
    if (!server) throw new Error('This saved server no longer exists.');

    const target: RdpProxyTarget = {
      sessionId,
      host: server.host,
      port: server.port,
      expectedFingerprint: server.certFingerprint,
    };
    // `DOMAIN\user` is how people type it on Windows; the engine wants the parts apart.
    // A `user@domain` name is passed through as is, which Windows accepts.
    const slash = server.username.indexOf('\\');
    const username = slash > 0 ? server.username.slice(slash + 1) : server.username;
    const domain = slash > 0 ? server.username.slice(0, slash) : server.domain;

    return {
      sessionId,
      serverId: server.id,
      nickname: server.nickname,
      proxyUrl: await proxy.issueUrl(target),
      destination: formatDestination(server.host, server.port),
      username,
      domain,
      password: server.secretEnvelope ? await decryptSecret(server.secretEnvelope) : '',
      options: withRdpDefaults(server.options),
    };
  });

  ipcMain.handle(
    IPC.rdp.respondCertificate,
    async (event, sessionId: string, trust: boolean): Promise<void> => {
      const session = sessionFor(event, sessionId);
      const pending = session.pendingCertificate;
      session.pendingCertificate = null;
      if (trust && pending) {
        await updateServer(session.serverId, (s) => ({
          ...s,
          certFingerprint: pending.fingerprint,
        }));
      }
    },
  );

  ipcMain.handle(
    IPC.rdp.readClipboardFiles,
    async (
      event,
      sessionId: string,
      previousSignature: string | null,
    ): Promise<RdpClipboardFiles | 'unchanged' | null> => {
      const session = sessionFor(event, sessionId);
      const result = await readClipboardFiles(previousSignature);
      if (result === 'unchanged') return result;
      session.clipboard = result;
      return result?.files ?? null;
    },
  );

  // Only files from the listing above can be read, by index, so the window can't ask for
  // an arbitrary path.
  ipcMain.handle(
    IPC.rdp.readClipboardFile,
    async (event, sessionId: string, signature: string, index: number): Promise<Uint8Array> => {
      const session = sessionFor(event, sessionId);
      const set = session.clipboard;
      if (!set || set.files.signature !== signature || set.files.tooLarge) {
        throw new Error('The copied files changed. Copy them again.');
      }
      const source = set.sources[index];
      if (!source) throw new Error('That entry is not a file.');
      return new Uint8Array(await readFile(source));
    },
  );

  ipcMain.handle(
    IPC.rdp.beginDownload,
    async (event, sessionId: string): Promise<RdpDownloadTarget | null> => {
      sessionFor(event, sessionId);
      const result = await dialog.showOpenDialog({
        title: 'Save files from the server',
        defaultPath: app.getPath('downloads'),
        buttonLabel: 'Save here',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      const folder = result.filePaths[0];
      return { downloadId: beginDownload(event.sender.id, folder), folder };
    },
  );

  ipcMain.handle(
    IPC.rdp.prepareDownloadEntry,
    (
      event,
      downloadId: string,
      index: number,
      entry: { name: string; path?: string; isDirectory: boolean },
    ): Promise<string> => prepareEntry(downloadId, event.sender.id, index, entry),
  );

  ipcMain.handle(
    IPC.rdp.writeDownloadChunk,
    (event, downloadId: string, index: number, bytes: Uint8Array): Promise<void> =>
      writeChunk(downloadId, event.sender.id, index, bytes),
  );

  ipcMain.handle(
    IPC.rdp.finishDownloadFile,
    (event, downloadId: string, index: number, ok: boolean): Promise<void> =>
      finishFile(downloadId, event.sender.id, index, ok),
  );

  ipcMain.handle(IPC.rdp.openDownloadFolder, async (event, downloadId: string): Promise<void> => {
    await shell.openPath(downloadFolder(downloadId, event.sender.id));
  });
}

/** How many Remote Desktop sessions are open, for the confirmation shown before the app closes. */
export function openRdpSessionCount(): number {
  return sessions.size;
}

/** Called from `before-quit`. */
export function closeAllRdpSessions(): void {
  closeAllRdpWindows();
  proxy.shutdown();
  sessions.clear();
  syncPowerSaveBlocker();
}
