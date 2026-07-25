import { randomUUID } from 'node:crypto';
import { ipcMain } from 'electron';
import type { ProjectDraft, ProjectDraftStatus } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { CreateProjectDraftInput } from '../../shared/apiTypes';
import { store } from '../store';

export function registerProjectDraftHandlers(): void {
  ipcMain.handle(
    IPC.projectDrafts.listByProject,
    async (_event, projectId: string): Promise<ProjectDraft[]> => {
      const drafts = await store.getProjectDrafts();
      return drafts.filter((draft) => draft.projectId === projectId);
    },
  );

  ipcMain.handle(
    IPC.projectDrafts.create,
    async (_event, input: CreateProjectDraftInput): Promise<ProjectDraft> => {
      const draft: ProjectDraft = {
        id: randomUUID(),
        projectId: input.projectId,
        rawInput: input.rawInput,
        promptType: input.promptType,
        targetAI: input.targetAI,
        content: input.content,
        status: 'draft',
        createdAt: new Date().toISOString(),
        implementedAt: null,
      };
      const drafts = await store.getProjectDrafts();
      drafts.push(draft);
      await store.setProjectDrafts(drafts);
      return draft;
    },
  );

  ipcMain.handle(
    IPC.projectDrafts.updateStatus,
    async (_event, draftId: string, status: ProjectDraftStatus): Promise<void> => {
      const drafts = await store.getProjectDrafts();
      const index = drafts.findIndex((draft) => draft.id === draftId);
      if (index === -1) return;
      drafts[index] = {
        ...drafts[index],
        status,
        // Reopening clears the timestamp so it can't claim a date it was never finished on.
        implementedAt: status === 'implemented' ? new Date().toISOString() : null,
      };
      await store.setProjectDrafts(drafts);
    },
  );

  ipcMain.handle(IPC.projectDrafts.remove, async (_event, draftId: string): Promise<void> => {
    const drafts = await store.getProjectDrafts();
    await store.setProjectDrafts(drafts.filter((draft) => draft.id !== draftId));
  });
}
