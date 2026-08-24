import { randomUUID } from 'node:crypto';
import type { AppNotification, Project } from '@agentmat/core';
import { BrowserWindow } from 'electron';
import type { GithubWorkflowRunInfo } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import type { PetPipelineMessage, PetPipelineRunRef } from '../../shared/pet';
import { petDisplayName } from '../pet/names';
import { petManager } from '../pet/petWindow';
import { type PipelineWatchState, store } from '../store';
import { fetchProjectPipelineStatus, githubRepoForFolder, listWorkflowRuns } from './githubActions';

const TICK_MS = 45_000;
const MAX_NOTIFICATIONS = 200;

let timer: NodeJS.Timeout | null = null;
let ticking = false;

function watchKey(projectId: string, workflowId: number): string {
  return `${projectId}:${workflowId}`;
}

function broadcastNotificationsChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send(IPC.appNotifications.onChanged);
  }
}

function petSpeech(kind: 'pass' | 'fail', projectName: string, workflowName: string): string {
  if (kind === 'fail') return `${workflowName} on ${projectName} just failed.`;
  return `${workflowName} on ${projectName} passed.`;
}

function isFailedConclusion(conclusion: GithubWorkflowRunInfo['conclusion']): boolean {
  return conclusion === 'failure' || conclusion === 'timed_out';
}

async function appendFailureNotification(input: {
  project: Project;
  workflowName: string;
  run: GithubWorkflowRunInfo;
}): Promise<void> {
  const items = await store.getAppNotifications();
  if (items.some((item) => item.htmlUrl === input.run.htmlUrl)) return;
  const notification: AppNotification = {
    id: randomUUID(),
    kind: 'pipeline-failure',
    title: `${input.workflowName} failed`,
    body: `${input.project.name} · ${input.run.headBranch || 'unknown branch'} · run #${input.run.runNumber}`,
    projectId: input.project.id,
    projectName: input.project.name,
    htmlUrl: input.run.htmlUrl,
    createdAt: new Date().toISOString(),
    read: false,
  };
  items.unshift(notification);
  await store.setAppNotifications(items.slice(0, MAX_NOTIFICATIONS));
  broadcastNotificationsChanged();
}

async function maybeSpeak(
  kind: 'pass' | 'fail',
  project: Project,
  workflowName: string,
  run?: PetPipelineRunRef,
): Promise<void> {
  const settings = await store.getSettings();
  if (!settings.desktopPetEnabled) return;
  if (kind === 'fail' && !settings.desktopPetPipelineOnFail) return;
  if (kind === 'pass' && !settings.desktopPetPipelineOnPass) return;

  const payload: PetPipelineMessage = {
    kind,
    petName: petDisplayName(
      settings.desktopPetCharacterId,
      settings.desktopPetCustoms ?? [],
      settings.desktopPetName,
    ),
    text: petSpeech(kind, project.name, workflowName),
    projectName: project.name,
    workflowName,
    run,
  };
  petManager.sendPipelineMessage(payload);
}

async function processWatchedWorkflow(
  project: Project,
  workflowId: number,
  workflowName: string,
  owner: string,
  repo: string,
  watch: PipelineWatchState,
): Promise<boolean> {
  const key = watchKey(project.id, workflowId);
  const runs = await listWorkflowRuns(owner, repo, workflowId, 5);
  const completed = runs.filter((run) => run.status === 'completed');
  const lastSeen = watch.lastCompletedRunId[key];

  if (lastSeen == null) {
    const newest = completed[0];
    watch.lastCompletedRunId[key] = newest?.id ?? 0;
    return true;
  }

  const fresh = completed.filter((run) => run.id > lastSeen).sort((a, b) => a.id - b.id);
  if (fresh.length === 0) return false;

  watch.lastCompletedRunId[key] = fresh[fresh.length - 1].id;
  for (const run of fresh) {
    const name = workflowName || run.name;
    if (isFailedConclusion(run.conclusion)) {
      await appendFailureNotification({ project, workflowName: name, run });
      // The ref rides along so clicking the bubble opens this run on the
      // Pipelines page instead of just raising the window.
      await maybeSpeak('fail', project, name, { runId: run.id, repo: `${owner}/${repo}` });
    } else if (run.conclusion === 'success') {
      await maybeSpeak('pass', project, name);
    }
  }
  return true;
}

export async function seedWatchedWorkflow(projectId: string, workflowId: number): Promise<void> {
  const projects = await store.getProjects();
  const project = projects.find((item) => item.id === projectId);
  if (!project) return;
  const github = await githubRepoForFolder(project.folderPath);
  if (!github) return;
  try {
    const runs = await listWorkflowRuns(github.owner, github.repo, workflowId, 5);
    const newest = runs.find((run) => run.status === 'completed');
    const watch = await store.getPipelineWatch();
    watch.lastCompletedRunId[watchKey(projectId, workflowId)] = newest?.id ?? 0;
    await store.setPipelineWatch(watch);
  } catch {
    // First poll will seed instead.
  }
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const projects = await store.getProjects();
    const watch = await store.getPipelineWatch();
    let dirty = false;
    for (const project of projects) {
      const watched = project.githubActions ?? [];
      if (watched.length === 0) continue;
      const github = await githubRepoForFolder(project.folderPath);
      if (!github) continue;
      for (const action of watched) {
        try {
          const changed = await processWatchedWorkflow(
            project,
            action.workflowId,
            action.name,
            github.owner,
            github.repo,
            watch,
          );
          if (changed) dirty = true;
        } catch {
          // Offline or a missing workflow. The next tick retries.
        }
      }
    }
    if (dirty) await store.setPipelineWatch(watch);
  } finally {
    ticking = false;
  }
}

export function startPipelineWatcher(): void {
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  void tick();
}

export function stopPipelineWatcher(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export function schedulePipelineCheck(projectId?: string): void {
  void (async () => {
    if (projectId) {
      const projects = await store.getProjects();
      const project = projects.find((item) => item.id === projectId);
      if (!project || (project.githubActions ?? []).length === 0) return;
    }
    await tick();
  })();
}

/** Used by the Git tab so connecting a workflow immediately shows current status. */
export async function refreshProjectPipelineStatus(projectId: string) {
  const projects = await store.getProjects();
  const project = projects.find((item) => item.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return fetchProjectPipelineStatus(project);
}
