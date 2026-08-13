import { ipcMain } from 'electron';
import type { AppNotification, ProjectGithubAction } from '@agentmat/core';
import { normalizeProjectGithubActions } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { GithubActionsActivity, ProjectPipelineStatus } from '../../shared/apiTypes';
import { store } from '../store';
import { fetchDashboardActionsActivity, setProjectWatchedActions } from '../pipelines/githubActions';
import {
  refreshProjectPipelineStatus,
  schedulePipelineCheck,
  seedWatchedWorkflow,
} from '../pipelines/watcher';

export function registerPipelineHandlers(): void {
  ipcMain.handle(
    IPC.pipelines.status,
    async (_event, projectId: string): Promise<ProjectPipelineStatus> => {
      return refreshProjectPipelineStatus(String(projectId));
    },
  );

  ipcMain.handle(
    IPC.pipelines.setWatched,
    async (
      _event,
      projectId: string,
      actions: ProjectGithubAction[],
    ): Promise<ProjectPipelineStatus> => {
      const id = String(projectId);
      const current = await store.getProjects().then((list) => list.find((item) => item.id === id));
      const previousIds = new Set((current?.githubActions ?? []).map((item) => item.workflowId));
      const next = normalizeProjectGithubActions(actions);
      await setProjectWatchedActions(id, next);
      for (const action of next) {
        if (!previousIds.has(action.workflowId)) {
          await seedWatchedWorkflow(id, action.workflowId);
        }
      }
      schedulePipelineCheck(id);
      return refreshProjectPipelineStatus(id);
    },
  );

  ipcMain.handle(IPC.pipelines.dashboardActivity, (): Promise<GithubActionsActivity> => {
    return fetchDashboardActionsActivity();
  });

  ipcMain.handle(IPC.pipelines.listNotifications, (): Promise<AppNotification[]> => {
    return store.getAppNotifications();
  });

  ipcMain.handle(IPC.pipelines.unreadCount, async (): Promise<number> => {
    const items = await store.getAppNotifications();
    return items.filter((item) => !item.read).length;
  });

  ipcMain.handle(
    IPC.pipelines.markRead,
    async (_event, notificationId: string): Promise<AppNotification[]> => {
      const items = await store.getAppNotifications();
      const next = items.map((item) =>
        item.id === notificationId ? { ...item, read: true } : item,
      );
      await store.setAppNotifications(next);
      return next;
    },
  );

  ipcMain.handle(IPC.pipelines.markAllRead, async (): Promise<AppNotification[]> => {
    const items = await store.getAppNotifications();
    const next = items.map((item) => (item.read ? item : { ...item, read: true }));
    await store.setAppNotifications(next);
    return next;
  });

  ipcMain.handle(
    IPC.pipelines.removeNotification,
    async (_event, notificationId: string): Promise<AppNotification[]> => {
      const items = await store.getAppNotifications();
      const next = items.filter((item) => item.id !== notificationId);
      await store.setAppNotifications(next);
      return next;
    },
  );
}
