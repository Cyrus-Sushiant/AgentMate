import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app, ipcMain } from 'electron';
import type {
  AiProvider,
  HelpAskInput,
  HelpAskResult,
  HelpIndexProgress,
  HelpIndexStatus,
} from '../../shared/apiTypes';
import { HELP_ARTICLES } from '../../shared/help/articles';
import { IPC } from '../../shared/ipcChannels';
import { chunkArticles } from '../help/chunker';
import { createEmbedder } from '../help/embedders';
import { createHelpService, type HelpService } from '../help/helpService';
import { store } from '../store';
import { runAiPrompt } from './ai';
import { broadcastToWindows } from './send';

/** Long enough for a first question that also embeds every article on a slow connection. */
const HELP_ASK_TIMEOUT_MS = 5 * 60_000;

let service: HelpService | null = null;

/** The service is built on first use, so the index database is only opened when someone asks. */
function helpService(): HelpService {
  if (!service) {
    const dir = join(app.getPath('userData'), 'data');
    mkdirSync(dir, { recursive: true });
    service = createHelpService({
      dbFile: join(dir, 'help-index.db'),
      chunks: () => chunkArticles(HELP_ARTICLES),
      getSettings: () => store.getSettings(),
      runPrompt: runAiPrompt,
      createEmbedder,
      onProgress: (progress: HelpIndexProgress) =>
        broadcastToWindows(IPC.help.onIndexProgress, progress),
    });
  }
  return service;
}

/** Closes the index database. Tests call it so Windows can delete the temp profile. */
export function closeHelpIndex(): void {
  service?.close();
  service = null;
}

const inFlight = new Map<string, AbortController>();

export function registerHelpHandlers(): void {
  ipcMain.handle(IPC.help.ask, async (_event, input: HelpAskInput): Promise<HelpAskResult> => {
    const controller = new AbortController();
    if (input.requestId) inFlight.set(input.requestId, controller);
    try {
      return await helpService().ask(
        input,
        AbortSignal.any([controller.signal, AbortSignal.timeout(HELP_ASK_TIMEOUT_MS)]),
      );
    } finally {
      if (input.requestId) inFlight.delete(input.requestId);
    }
  });

  ipcMain.handle(IPC.help.cancel, (_event, requestId: string): boolean => {
    const controller = inFlight.get(requestId);
    if (!controller) return false;
    controller.abort();
    inFlight.delete(requestId);
    return true;
  });

  ipcMain.handle(
    IPC.help.status,
    (_event, provider: AiProvider): Promise<HelpIndexStatus> => helpService().status(provider),
  );
}
