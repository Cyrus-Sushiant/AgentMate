import { ipcMain, type WebContents } from 'electron';
import type {
  SymbolIndexPayload,
  TextSearchRequest,
  TextSearchSummary,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { projectFolder } from '../explorer/projectFolder';
import { symbolIndexer } from '../search/symbolIndex';
import { cancelOwnerSearch, cancelTextSearch, runTextSearch } from '../search/textSearch';
import { sendToContents } from './send';

const MAX_REQUEST_ID = 64;

function assertRequestId(requestId: unknown): asserts requestId is string {
  if (typeof requestId !== 'string' || !requestId || requestId.length > MAX_REQUEST_ID) {
    throw new Error('That search id is not valid.');
  }
}

/** Only the fields the search reads, with the types it expects, whatever the window sent. */
function readRequest(raw: unknown): TextSearchRequest {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    query: typeof value.query === 'string' ? value.query : '',
    matchCase: value.matchCase === true,
    wholeWord: value.wholeWord === true,
    regex: value.regex === true,
    maxMatches: typeof value.maxMatches === 'number' ? value.maxMatches : undefined,
  };
}

const watchedSenders = new WeakSet<WebContents>();

/** A window that closes or reloads mid-search leaves nobody to read the results. */
function stopWhenGone(sender: WebContents): void {
  if (watchedSenders.has(sender)) return;
  watchedSenders.add(sender);
  sender.once('destroyed', () => cancelOwnerSearch(sender.id));
}

export function registerWorkspaceSearchHandlers(): void {
  ipcMain.handle(
    IPC.workspaceSearch.text,
    async (
      event,
      projectId: unknown,
      requestId: unknown,
      request: unknown,
    ): Promise<TextSearchSummary> => {
      assertRequestId(requestId);
      const folder = await projectFolder(projectId);
      const sender = event.sender;
      stopWhenGone(sender);
      return runTextSearch({
        ownerId: sender.id,
        requestId,
        folder,
        request: readRequest(request),
        onBatch: (files) =>
          sendToContents(sender, IPC.workspaceSearch.onTextResults, { requestId, files }),
      });
    },
  );

  ipcMain.handle(IPC.workspaceSearch.cancel, (_event, requestId: unknown): boolean => {
    assertRequestId(requestId);
    return cancelTextSearch(requestId);
  });

  ipcMain.handle(
    IPC.workspaceSearch.symbols,
    async (_event, projectId: unknown, sinceVersion: unknown): Promise<SymbolIndexPayload> => {
      const folder = await projectFolder(projectId);
      return symbolIndexer.get(folder, {
        sinceVersion: typeof sinceVersion === 'number' ? sinceVersion : undefined,
      });
    },
  );
}
