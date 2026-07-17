import { randomUUID } from 'node:crypto';
import { ipcMain } from 'electron';
import type { PromptTemplate } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { SaveTemplateInput } from '../../shared/apiTypes';
import { store } from '../store';

export function registerTemplateHandlers(): void {
  ipcMain.handle(IPC.templates.list, (): Promise<PromptTemplate[]> => store.getTemplates());

  ipcMain.handle(
    IPC.templates.save,
    async (_event, input: SaveTemplateInput): Promise<PromptTemplate> => {
      const template: PromptTemplate = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...input,
      };
      const templates = await store.getTemplates();
      templates.unshift(template);
      await store.setTemplates(templates);
      return template;
    },
  );

  ipcMain.handle(IPC.templates.delete, async (_event, templateId: string): Promise<void> => {
    const templates = await store.getTemplates();
    await store.setTemplates(templates.filter((t) => t.id !== templateId));
  });
}
