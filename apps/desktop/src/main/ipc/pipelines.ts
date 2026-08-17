import { ipcMain } from 'electron';
import type { ProjectGithubAction } from '@agentmat/core';
import { normalizeProjectGithubActions } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type {
  GithubActionsActivity,
  GithubActionsRunErrorInput,
  GithubActionsRunErrorResult,
  ProjectPipelineStatus,
} from '../../shared/apiTypes';
import { store } from '../store';
import {
  fetchDashboardActionsActivity,
  fetchRunFailureText,
  setProjectWatchedActions,
} from '../pipelines/githubActions';
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

  ipcMain.handle(
    IPC.pipelines.runError,
    (_event, input: GithubActionsRunErrorInput): Promise<GithubActionsRunErrorResult> => {
      return fetchRunFailureText(input);
    },
  );
}
