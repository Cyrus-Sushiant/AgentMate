import { createServer, type Server } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import type { NotificationHookKind } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { ConfirmationForwardedPayload } from '../../shared/apiTypes';
import { store } from '../store';
import { findSessionIdForProject, writeToSession } from '../ipc/terminal';
import { pollTelegramUpdates, sendTelegramMessage } from './telegramApi';

let server: Server | null = null;
let pollOffset = 0;
let pollingActive = false;

const pendingConfirmations = new Map<string, { since: number }>();
const PENDING_TTL_MS = 20 * 60 * 1000;

function dataDir(): string {
  return join(app.getPath('userData'), 'data');
}

export function portFilePath(): string {
  return join(dataDir(), 'hook-server.json');
}

function renderMessage(template: string, projectName: string): string {
  return template.replaceAll('{{project}}', projectName);
}

async function handleHookRequest(projectId: string, kind: NotificationHookKind): Promise<void> {
  const [settings, projects] = await Promise.all([store.getSettings(), store.getProjects()]);
  const project = projects.find((p) => p.id === projectId);
  if (!project || !settings.telegramBotToken || !settings.telegramChatId) return;

  const hook = project.notifications[kind];
  if (!hook.enabled) return;

  const text = renderMessage(hook.message, project.name);
  const result = await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, text);
  if (!result.ok) return;

  if (kind === 'confirmation') {
    pendingConfirmations.set(projectId, { since: Date.now() });
    void runPollLoop();
  }
}

function notifyRenderer(payload: ConfirmationForwardedPayload): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) {
      win.webContents.send(IPC.notifications.onConfirmationForwarded, payload);
    }
  }
}

async function runPollLoop(): Promise<void> {
  if (pollingActive) return;
  pollingActive = true;
  try {
    while (pendingConfirmations.size > 0) {
      const now = Date.now();
      for (const [projectId, entry] of pendingConfirmations) {
        if (now - entry.since > PENDING_TTL_MS) pendingConfirmations.delete(projectId);
      }
      if (pendingConfirmations.size === 0) break;

      const settings = await store.getSettings();
      if (!settings.telegramBotToken || !settings.telegramChatId) break;

      let messages: { chatId: string; text: string }[];
      try {
        const result = await pollTelegramUpdates(settings.telegramBotToken, pollOffset);
        messages = result.messages;
        pollOffset = result.nextOffset;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      for (const message of messages) {
        if (message.chatId !== settings.telegramChatId) continue;
        const [oldestProjectId] = pendingConfirmations.keys();
        if (!oldestProjectId) continue;
        pendingConfirmations.delete(oldestProjectId);

        const sessionId = findSessionIdForProject(oldestProjectId);
        if (sessionId) writeToSession(sessionId, `${message.text}\r`);
        notifyRenderer({ projectId: oldestProjectId, sessionId: sessionId ?? '', text: message.text });
      }
    }
  } finally {
    pollingActive = false;
  }
}

export async function startHookServer(): Promise<void> {
  if (server) return;

  server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/hook') {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf-8');
    });
    req.on('end', () => {
      res.writeHead(204).end();
      try {
        const parsed = JSON.parse(body) as { projectId?: string; kind?: string };
        if (parsed.projectId && (parsed.kind === 'completion' || parsed.kind === 'confirmation')) {
          void handleHookRequest(parsed.projectId, parsed.kind);
        }
      } catch {
        // Malformed payload from a stale/hand-edited hook script; ignore.
      }
    });
  });

  await new Promise<void>((resolve) => {
    server!.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await mkdir(dataDir(), { recursive: true });
  await writeFile(portFilePath(), JSON.stringify({ port }), 'utf-8');

  // Establish a baseline offset (short timeout) so the poll loop only reacts
  // to messages sent after startup, not the bot's entire history.
  const settings = await store.getSettings();
  if (settings.telegramBotToken) {
    try {
      const { nextOffset } = await pollTelegramUpdates(settings.telegramBotToken, 0, 0);
      pollOffset = nextOffset;
    } catch {
      // best-effort baseline; falls back to offset 0
    }
  }
}

export function stopHookServer(): void {
  server?.close();
  server = null;
  pendingConfirmations.clear();
}
