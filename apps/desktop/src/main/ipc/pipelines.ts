import type { ProjectGithubAction } from '@agentmat/core';
import { normalizeProjectGithubActions } from '@agentmat/core';
import { ipcMain } from 'electron';
import type {
  GithubActionsActivity,
  GithubActionsRunErrorInput,
  GithubActionsRunErrorResult,
  GithubPipelineActionResult,
  GithubRunCancelRequest,
  GithubWorkflowDispatchRequest,
  GithubWorkflowRefsResult,
  ProjectPipelineStatus,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import {
  cancelWorkflowRun,
  dispatchWorkflow,
  fetchDashboardActionsActivity,
  fetchRunFailureText,
  fetchWorkflowRefs,
  setProjectWatchedActions,
} from '../pipelines/githubActions';
import {
  refreshProjectPipelineStatus,
  schedulePipelineCheck,
  seedWatchedWorkflow,
} from '../pipelines/watcher';
import { store } from '../store';

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

  ipcMain.handle(IPC.pipelines.refs, (_event, repo: string): Promise<GithubWorkflowRefsResult> => {
    return fetchWorkflowRefs(String(repo));
  });

  ipcMain.handle(
    IPC.pipelines.dispatch,
    async (_event, input: GithubWorkflowDispatchRequest): Promise<GithubPipelineActionResult> => {
      const result = await dispatchWorkflow(input);
      // The run takes a moment to appear on GitHub, so nudge the watcher rather than
      // waiting for its next tick.
      if (result.ok) schedulePipelineCheck();
      return result;
    },
  );

  ipcMain.handle(
    IPC.pipelines.cancelRun,
    async (_event, input: GithubRunCancelRequest): Promise<GithubPipelineActionResult> => {
      const result = await cancelWorkflowRun(input);
      if (result.ok) schedulePipelineCheck();
      return result;
    },
  );
}
