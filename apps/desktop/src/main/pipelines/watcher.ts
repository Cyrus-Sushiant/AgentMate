import { randomUUID } from 'node:crypto';
import type { AppNotification, Project } from '@agentmat/core';
import { BrowserWindow } from 'electron';
import type { GithubWorkflowRunInfo } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import type { PetPipelineMessage, PetPipelineRunRef } from '../../shared/pet';
import { petDisplayName } from '../pet/names';
import { petManager } from '../pet/petWindow';
import { type PipelineWatchState, store } from '../store';
import {
  fetchProjectPipelineStatus,
  githubRepoForFolder,
  listRepoRunsByWorkflow,
  listRepoWorkflows,
} from './githubActions';

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

function processWatchedWorkflow(
  project: Project,
  workflowId: number,
  workflowName: string,
  owner: string,
  repo: string,
  runs: GithubWorkflowRunInfo[],
  watch: PipelineWatchState,
): { changed: boolean; announce: (() => Promise<void>) | null } {
  const key = watchKey(project.id, workflowId);
  const completed = runs.filter((run) => run.status === 'completed');
  const lastSeen = watch.lastCompletedRunId[key];

  if (lastSeen == null) {
    // First time this workflow is seen. Remember where it stands so the next tick
    // only reports what happens from here on.
    const newest = completed[0];
    watch.lastCompletedRunId[key] = newest?.id ?? 0;
    return { changed: true, announce: null };
  }

  const fresh = completed.filter((run) => run.id > lastSeen).sort((a, b) => a.id - b.id);
  if (fresh.length === 0) return { changed: false, announce: null };

  watch.lastCompletedRunId[key] = fresh[fresh.length - 1].id;
  return {
    changed: true,
    announce: async () => {
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
    },
  };
}

/** The workflows of a project that still report, i.e. everything the user has not switched off. */
async function watchedWorkflows(
  project: Project,
  owner: string,
  repo: string,
): Promise<{ workflowId: number; name: string }[]> {
  const muted = new Set((project.githubActionsMuted ?? []).map((item) => item.workflowId));
  const workflows = await listRepoWorkflows(owner, repo);
  return workflows
    .filter((workflow) => !muted.has(workflow.id))
    .map((workflow) => ({ workflowId: workflow.id, name: workflow.name }));
}

/**
 * Drops what the watcher remembers about these workflows, so the next tick reads their
 * current state instead of replaying it. Called when a workflow is switched off: while it
 * is off nothing advances the mark, and switching it back on should not announce every run
 * that happened in between.
 */
export async function forgetWatchedWorkflows(
  projectId: string,
  workflowIds: number[],
): Promise<void> {
  if (workflowIds.length === 0) return;
  const watch = await store.getPipelineWatch();
  for (const workflowId of workflowIds) {
    delete watch.lastCompletedRunId[watchKey(projectId, workflowId)];
  }
  await store.setPipelineWatch(watch);
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const projects = await store.getProjects();
    const watch = await store.getPipelineWatch();
    const announcements: (() => Promise<void>)[] = [];
    // Two projects can sit in the same repo, and a repo only needs reading once a tick.
    const runsByRepo = new Map<string, Map<number, GithubWorkflowRunInfo[]>>();
    let dirty = false;
    for (const project of projects) {
      if (project.archived) continue;
      const github = await githubRepoForFolder(project.folderPath);
      if (!github) continue;
      try {
        const watched = await watchedWorkflows(project, github.owner, github.repo);
        if (watched.length === 0) continue;
        // One call covers the whole repo, however many workflows it has.
        const repoKey = `${github.owner}/${github.repo}`.toLowerCase();
        let runsByWorkflow = runsByRepo.get(repoKey);
        if (!runsByWorkflow) {
          runsByWorkflow = await listRepoRunsByWorkflow(github.owner, github.repo);
          runsByRepo.set(repoKey, runsByWorkflow);
        }
        for (const workflow of watched) {
          const result = processWatchedWorkflow(
            project,
            workflow.workflowId,
            workflow.name,
            github.owner,
            github.repo,
            runsByWorkflow.get(workflow.workflowId) ?? [],
            watch,
          );
          if (result.changed) dirty = true;
          if (result.announce) announcements.push(result.announce);
        }
      } catch {
        // Offline, rate limited, or the repo is gone. The next tick retries.
      }
    }
    // Saving before announcing means a crash here costs a notification rather than
    // repeating every one of them on the next launch.
    if (dirty) await store.setPipelineWatch(watch);
    for (const announce of announcements) await announce();
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
      if (!projects.some((item) => item.id === projectId)) return;
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
