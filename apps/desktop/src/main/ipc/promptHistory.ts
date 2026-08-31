import { ipcMain } from 'electron';
import type { AddPromptHistoryInput, PromptHistoryEntry } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { promptHistoryDb } from '../promptHistoryDb';
import { logActivity } from '../store';

export function registerPromptHistoryHandlers(): void {
  ipcMain.handle(
    IPC.promptHistory.list,
    (_event, projectId?: string | null): PromptHistoryEntry[] => promptHistoryDb.list(projectId),
  );

  ipcMain.handle(
    IPC.promptHistory.search,
    (_event, query: string, projectId?: string | null): PromptHistoryEntry[] =>
      promptHistoryDb.search(query, projectId),
  );

  ipcMain.handle(
    IPC.promptHistory.add,
    async (_event, input: AddPromptHistoryInput): Promise<PromptHistoryEntry> => {
      const entry = promptHistoryDb.add(input);
      // Translations carry no prompt type or target AI, so build the sentence
      // from whichever parts are actually filled in.
      const verb = input.source === 'translate' ? 'Translated' : 'Generated';
      const what = input.promptType ? `a ${input.promptType} prompt` : 'a prompt';
      const audience = input.targetAI ? ` for ${input.targetAI}` : '';
      await logActivity(
        'prompt-generated',
        `${verb} ${what}${audience}`,
        input.projectId ? { projectId: input.projectId } : undefined,
      );
      return entry;
    },
  );

  ipcMain.handle(IPC.promptHistory.remove, (_event, id: string): void =>
    promptHistoryDb.remove(id),
  );

  ipcMain.handle(IPC.promptHistory.setTags, (_event, id: string, tags: string[]): void =>
    promptHistoryDb.setTags(id, tags),
  );

  ipcMain.handle(
    IPC.promptHistory.setProject,
    (_event, id: string, projectId: string | null): void =>
      promptHistoryDb.setProject(id, projectId),
  );
}
