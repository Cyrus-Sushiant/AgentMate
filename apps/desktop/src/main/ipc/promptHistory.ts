import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type { AddPromptHistoryInput, PromptHistoryEntry } from '../../shared/apiTypes';
import { promptHistoryDb } from '../promptHistoryDb';
import { logActivity } from '../store';

export function registerPromptHistoryHandlers(): void {
  ipcMain.handle(IPC.promptHistory.list, (): PromptHistoryEntry[] => promptHistoryDb.list());

  ipcMain.handle(IPC.promptHistory.search, (_event, query: string): PromptHistoryEntry[] =>
    promptHistoryDb.search(query),
  );

  ipcMain.handle(
    IPC.promptHistory.add,
    async (_event, input: AddPromptHistoryInput): Promise<PromptHistoryEntry> => {
      const entry = promptHistoryDb.add(input);
      const verb = input.source === 'translate' ? 'Translated' : 'Generated';
      await logActivity('prompt-generated', `${verb} a ${input.promptType} prompt for ${input.targetAI}`);
      return entry;
    },
  );

  ipcMain.handle(IPC.promptHistory.remove, (_event, id: string): void => promptHistoryDb.remove(id));
}
