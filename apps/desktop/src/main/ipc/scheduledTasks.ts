import { randomUUID } from 'node:crypto';
import { ipcMain } from 'electron';
import type { ScheduledTask, ScheduledTaskStatus } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { CreateScheduledTasksInput } from '../../shared/apiTypes';
import { store } from '../store';
import { editTelegramMessage, sendTelegramMessage } from '../notifications/telegramApi';

const STATUS_LABEL: Record<ScheduledTaskStatus, string> = {
  pending: '⏳ Pending',
  completed: '✅ Completed',
  cancelled: '❌ Cancelled',
};

function renderTaskMessage(task: ScheduledTask, projectName: string): string {
  return [
    `📅 Scheduled task — ${projectName}`,
    `Target: ${task.targetAI}`,
    `Run at: ${new Date(task.runAt).toLocaleString()}`,
    `Status: ${STATUS_LABEL[task.status]}`,
    '',
    task.content,
  ].join('\n');
}

export function registerScheduledTaskHandlers(): void {
  ipcMain.handle(
    IPC.scheduledTasks.list,
    (): Promise<ScheduledTask[]> => store.getScheduledTasks(),
  );

  ipcMain.handle(
    IPC.scheduledTasks.listByProject,
    async (_event, projectId: string): Promise<ScheduledTask[]> => {
      const tasks = await store.getScheduledTasks();
      return tasks.filter((task) => task.projectId === projectId);
    },
  );

  ipcMain.handle(
    IPC.scheduledTasks.createMany,
    async (_event, input: CreateScheduledTasksInput): Promise<ScheduledTask[]> => {
      const now = new Date().toISOString();
      const created: ScheduledTask[] = input.tasks.map((task) => ({
        id: randomUUID(),
        projectId: input.projectId,
        rawInput: task.rawInput,
        promptType: task.promptType,
        targetAI: task.targetAI,
        content: task.content,
        runAt: task.runAt,
        status: 'pending',
        createdAt: now,
      }));

      const [settings, projects] = await Promise.all([store.getSettings(), store.getProjects()]);
      const { telegramBotToken, telegramScheduledTasksChatId } = settings;
      if (telegramBotToken && telegramScheduledTasksChatId) {
        const projectName =
          projects.find((p) => p.id === input.projectId)?.name ?? 'Unknown project';
        for (const task of created) {
          const result = await sendTelegramMessage(
            telegramBotToken,
            telegramScheduledTasksChatId,
            renderTaskMessage(task, projectName),
          );
          if (result.ok) {
            task.telegramChatId = telegramScheduledTasksChatId;
            task.telegramMessageId = result.messageId ?? null;
          }
        }
      }

      const tasks = await store.getScheduledTasks();
      tasks.push(...created);
      await store.setScheduledTasks(tasks);
      return created;
    },
  );

  ipcMain.handle(
    IPC.scheduledTasks.updateStatus,
    async (_event, taskId: string, status: ScheduledTaskStatus): Promise<void> => {
      const tasks = await store.getScheduledTasks();
      const index = tasks.findIndex((task) => task.id === taskId);
      if (index === -1) return;
      const updated = { ...tasks[index], status };
      tasks[index] = updated;
      await store.setScheduledTasks(tasks);

      if (updated.telegramChatId && updated.telegramMessageId) {
        const settings = await store.getSettings();
        if (settings.telegramBotToken) {
          const projects = await store.getProjects();
          const projectName =
            projects.find((p) => p.id === updated.projectId)?.name ?? 'Unknown project';
          await editTelegramMessage(
            settings.telegramBotToken,
            updated.telegramChatId,
            updated.telegramMessageId,
            renderTaskMessage(updated, projectName),
          );
        }
      }
    },
  );

  ipcMain.handle(IPC.scheduledTasks.remove, async (_event, taskId: string): Promise<void> => {
    const tasks = await store.getScheduledTasks();
    await store.setScheduledTasks(tasks.filter((task) => task.id !== taskId));
  });
}
