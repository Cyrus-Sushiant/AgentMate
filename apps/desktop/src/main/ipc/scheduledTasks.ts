import { randomUUID } from 'node:crypto';
import { ipcMain } from 'electron';
import type { ScheduledTask, ScheduledTaskStatus } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { CreateScheduledTasksInput } from '../../shared/apiTypes';
import { store } from '../store';

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
      tasks[index] = { ...tasks[index], status };
      await store.setScheduledTasks(tasks);
    },
  );

  ipcMain.handle(IPC.scheduledTasks.remove, async (_event, taskId: string): Promise<void> => {
    const tasks = await store.getScheduledTasks();
    await store.setScheduledTasks(tasks.filter((task) => task.id !== taskId));
  });
}
