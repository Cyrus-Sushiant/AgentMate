import { randomUUID } from 'node:crypto';
import type { ScheduledTask, ScheduledTaskStatus } from '@agentmat/core';
import { ipcMain } from 'electron';
import type { CreateScheduledTasksInput } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { editTelegramMessage, sendTelegramMessage } from '../notifications/telegramApi';
import { store } from '../store';

const STATUS_LABEL: Record<ScheduledTaskStatus, string> = {
  pending: '⏳ Pending',
  completed: '✅ Completed',
  cancelled: '❌ Cancelled',
};

function renderTaskMessage(task: ScheduledTask, projectName: string): string {
  return [
    `📅 Scheduled task: ${projectName}`,
    `Target: ${task.targetAI}`,
    `Run at: ${new Date(task.runAt).toLocaleString()}`,
    `Status: ${STATUS_LABEL[task.status]}`,
    '',
    task.content,
  ].join('\n');
}

async function projectName(projectId: string): Promise<string> {
  const projects = await store.getProjects();
  return projects.find((p) => p.id === projectId)?.name ?? 'Unknown project';
}

/**
 * Announces each new task in the Telegram chat set aside for scheduled tasks and
 * records the message it posted, so `updateStatus` can edit that same message
 * later instead of posting a second one. A task is created either way, so a
 * missing token or a failed send is silently skipped rather than raised.
 */
async function announceOnTelegram(tasks: ScheduledTask[], projectId: string): Promise<void> {
  const settings = await store.getSettings();
  const { telegramBotToken, telegramScheduledTasksChatId } = settings;
  if (!telegramBotToken || !telegramScheduledTasksChatId) return;

  const name = await projectName(projectId);
  for (const task of tasks) {
    const result = await sendTelegramMessage(
      telegramBotToken,
      telegramScheduledTasksChatId,
      renderTaskMessage(task, name),
    );
    if (result.ok) {
      task.telegramChatId = telegramScheduledTasksChatId;
      task.telegramMessageId = result.messageId ?? null;
    }
  }
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

      await announceOnTelegram(created, input.projectId);

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
          await editTelegramMessage(
            settings.telegramBotToken,
            updated.telegramChatId,
            updated.telegramMessageId,
            renderTaskMessage(updated, await projectName(updated.projectId)),
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
