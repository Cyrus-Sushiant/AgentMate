import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import type { AgentHookEvent, NotificationHookKind } from '@agentmat/core';
import { NOTIFICATION_HOOK_KINDS } from '@agentmat/core';
import { app, BrowserWindow } from 'electron';
import type { ConfirmationForwardedPayload } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { agentStatus } from '../agents/statusTracker';
import { findSessionIdForProject, SESSION_ID_PATTERN, writeToSession } from '../ipc/terminal';
import { store } from '../store';
import { speakOnPet } from './petNotifier';
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
  if (!project) return;

  const hook = project.notifications[kind];
  if (!hook.enabled) return;

  if (kind === 'pet') {
    speakOnPet(settings, project.name, renderMessage(hook.message, project.name));
    return;
  }

  if (!settings.telegramBotToken || !settings.telegramChatId) return;

  const text = renderMessage(hook.message, project.name);
  const result = await sendTelegramMessage(
    settings.telegramBotToken,
    settings.telegramChatId,
    text,
  );
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
        notifyRenderer({
          projectId: oldestProjectId,
          sessionId: sessionId ?? '',
          text: message.text,
        });
      }
    }
  } finally {
    pollingActive = false;
  }
}

/** Hook payloads are a few hundred bytes; anything far bigger is not from our script. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Written next to the port so only scripts AgentMate generated (which read the file) can
 * move a tab's status. Other local processes can reach the port, but not the file.
 */
const agentEventToken = randomBytes(24).toString('hex');

function tokenMatches(candidate: unknown): boolean {
  if (typeof candidate !== 'string') return false;
  const expected = Buffer.from(agentEventToken);
  const given = Buffer.from(candidate);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Maps a Claude Code hook event to what it means for the tab's status, or null to ignore it. */
function agentHookEvent(payload: {
  event?: unknown;
  notificationType?: unknown;
  message?: unknown;
}): AgentHookEvent | null {
  switch (payload.event) {
    case 'UserPromptSubmit':
      return 'prompt';
    case 'Stop':
      return 'stop';
    case 'SessionEnd':
      return 'session-end';
    case 'Notification': {
      // "Still waiting" reminders after a minute idle are not a new question.
      if (payload.notificationType === 'idle_prompt') return null;
      if (
        payload.notificationType === 'permission_prompt' ||
        payload.notificationType === 'elicitation_dialog' ||
        payload.notificationType === 'elicitation_url_dialog' ||
        payload.notificationType === 'agent_needs_input'
      ) {
        return 'needs-input';
      }
      const message = typeof payload.message === 'string' ? payload.message : '';
      return /permission|approv|needs your|waiting for your/i.test(message) ? 'needs-input' : null;
    }
    default:
      return null;
  }
}

function handleAgentEvent(body: string): void {
  const parsed = JSON.parse(body) as {
    token?: unknown;
    sessionId?: unknown;
    event?: unknown;
    notificationType?: unknown;
    message?: unknown;
    model?: unknown;
    effort?: unknown;
    transcriptPath?: unknown;
  };
  if (!tokenMatches(parsed.token)) return;
  if (typeof parsed.sessionId !== 'string' || !SESSION_ID_PATTERN.test(parsed.sessionId)) return;
  void agentStatus.runInfo(parsed.sessionId, {
    model: typeof parsed.model === 'string' ? parsed.model.slice(0, 100) : undefined,
    effort: typeof parsed.effort === 'string' ? parsed.effort.slice(0, 20) : undefined,
    transcriptPath:
      typeof parsed.transcriptPath === 'string' ? parsed.transcriptPath : undefined,
  });
  const event = agentHookEvent(parsed);
  if (!event) return;
  const message =
    event === 'needs-input' && typeof parsed.message === 'string'
      ? parsed.message.slice(0, 200)
      : undefined;
  agentStatus.hook(parsed.sessionId, event, message);
}

export async function startHookServer(): Promise<void> {
  if (server) return;

  server = createServer((req, res) => {
    const route = req.method === 'POST' ? req.url : null;
    if (route !== '/hook' && route !== '/agent-event') {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      if (tooLarge) return;
      body += chunk.toString('utf-8');
      if (body.length > MAX_BODY_BYTES) {
        tooLarge = true;
        res.writeHead(413).end();
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      res.writeHead(204).end();
      if (route === '/agent-event') {
        try {
          handleAgentEvent(body);
        } catch {
          // A malformed event from a stale script; the heuristic still covers the tab.
        }
        return;
      }
      try {
        const parsed = JSON.parse(body) as { projectId?: string; kind?: string };
        const kind = NOTIFICATION_HOOK_KINDS.find((candidate) => candidate === parsed.kind);
        if (parsed.projectId && kind) {
          void handleHookRequest(parsed.projectId, kind).catch(() => {
            // Nothing to report back: the hook script has already exited.
          });
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
  // Older generated scripts only read `port`, so adding the token keeps them working.
  await writeFile(portFilePath(), JSON.stringify({ port, token: agentEventToken }), 'utf-8');

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
