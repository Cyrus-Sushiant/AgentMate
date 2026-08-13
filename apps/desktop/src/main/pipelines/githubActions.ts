import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Project, ProjectGithubAction } from '@agentmat/core';
import { normalizeProjectGithubActions } from '@agentmat/core';
import type {
  GithubActionsActivity,
  GithubActionsDayCount,
  GithubActionsHistoryItem,
  GithubWorkflowInfo,
  GithubWorkflowRunInfo,
  PipelineConclusion,
  PipelineRunStatus,
  ProjectPipelineStatus,
} from '../../shared/apiTypes';
import { ghApi, ghErrorMessage, isGhCliAvailable, parseGithubRemote } from '../git/githubCli';
import { store } from '../store';

const execFileAsync = promisify(execFile);

interface GhWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
  html_url: string;
  badge_url: string;
}

interface GhRun {
  id: number;
  workflow_id: number;
  name: string;
  display_title?: string;
  run_number: number;
  head_branch: string | null;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export async function githubRepoForFolder(
  folderPath: string,
): Promise<{ owner: string; repo: string } | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', folderPath, 'remote', 'get-url', 'origin'],
      { timeout: 8000, windowsHide: true },
    );
    return parseGithubRemote(stdout.trim());
  } catch {
    return null;
  }
}

function toRunStatus(value: string): PipelineRunStatus {
  switch (value) {
    case 'queued':
    case 'in_progress':
    case 'completed':
    case 'waiting':
    case 'requested':
    case 'pending':
      return value;
    default:
      return 'unknown';
  }
}

function toConclusion(value: string | null): PipelineConclusion {
  switch (value) {
    case 'success':
    case 'failure':
    case 'cancelled':
    case 'skipped':
    case 'timed_out':
    case 'action_required':
    case 'neutral':
    case 'stale':
      return value;
    default:
      return null;
  }
}

function toWorkflow(item: GhWorkflow): GithubWorkflowInfo {
  return {
    id: item.id,
    name: item.name,
    path: item.path,
    state: item.state,
    htmlUrl: item.html_url,
    badgeUrl: item.badge_url,
  };
}

export function toWorkflowRun(item: GhRun): GithubWorkflowRunInfo {
  return {
    id: item.id,
    workflowId: item.workflow_id,
    name: item.name,
    displayTitle: item.display_title?.trim() || item.name,
    runNumber: item.run_number,
    headBranch: item.head_branch ?? '',
    status: toRunStatus(item.status),
    conclusion: toConclusion(item.conclusion),
    htmlUrl: item.html_url,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

const ACTIVITY_DAYS = 14;
const MAX_REPOS = 12;
const RUNS_PER_REPO = 30;
const HISTORY_CAP = 50;

function localIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyActivityDays(): GithubActionsDayCount[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: GithubActionsDayCount[] = [];
  for (let offset = ACTIVITY_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    days.push({ date: localIsoDate(day), passed: 0, failed: 0 });
  }
  return days;
}

function emptyActivity(
  partial: Pick<
    GithubActionsActivity,
    'ok' | 'cliAvailable' | 'authenticated'
  > & { error?: string },
): GithubActionsActivity {
  return {
    ...partial,
    days: emptyActivityDays(),
    runs: [],
    weekPassed: 0,
    weekFailed: 0,
    runningCount: 0,
    repoCount: 0,
  };
}

/** Recent Actions runs across AgentMate projects, for the dashboard chart. */
export async function fetchDashboardActionsActivity(): Promise<GithubActionsActivity> {
  if (!(await isGhCliAvailable())) {
    return emptyActivity({
      ok: false,
      cliAvailable: false,
      authenticated: false,
      error: 'Install the GitHub CLI and sign in to see GitHub Actions.',
    });
  }

  const projects = await store.getProjects();
  const repos: {
    owner: string;
    repo: string;
    projectId: string;
    projectName: string;
  }[] = [];
  const seen = new Set<string>();
  for (const project of projects) {
    const github = await githubRepoForFolder(project.folderPath);
    if (!github) continue;
    const key = `${github.owner}/${github.repo}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    repos.push({
      owner: github.owner,
      repo: github.repo,
      projectId: project.id,
      projectName: project.name,
    });
    if (repos.length >= MAX_REPOS) break;
  }

  if (repos.length === 0) {
    return emptyActivity({ ok: true, cliAvailable: true, authenticated: true });
  }

  try {
    const batches = await Promise.all(
      repos.map(async (item) => {
        const payload = await ghApi<{ workflow_runs?: GhRun[] }>(
          `repos/${item.owner}/${item.repo}/actions/runs?per_page=${RUNS_PER_REPO}`,
        );
        return (payload.workflow_runs ?? []).map((run) => ({ run, item }));
      }),
    );

    const days = emptyActivityDays();
    const byDate = new Map(days.map((day) => [day.date, day]));
    const weekStart = days[Math.max(0, days.length - 7)]?.date ?? days[0]?.date;
    let weekPassed = 0;
    let weekFailed = 0;
    let runningCount = 0;
    const history: GithubActionsHistoryItem[] = [];

    for (const { run, item } of batches.flat()) {
      const mapped = toWorkflowRun(run);
      const repo = `${item.owner}/${item.repo}`;
      history.push({
        id: mapped.id,
        projectId: item.projectId,
        projectName: item.projectName,
        repo,
        workflowName: mapped.name,
        displayTitle: mapped.displayTitle,
        runNumber: mapped.runNumber,
        headBranch: mapped.headBranch,
        status: mapped.status,
        conclusion: mapped.conclusion,
        htmlUrl: mapped.htmlUrl,
        createdAt: mapped.createdAt,
        updatedAt: mapped.updatedAt,
      });

      if (mapped.status !== 'completed') {
        runningCount += 1;
        continue;
      }

      const dayKey = localIsoDate(new Date(mapped.updatedAt));
      const bucket = byDate.get(dayKey);
      const failed = mapped.conclusion === 'failure' || mapped.conclusion === 'timed_out';
      const passed = mapped.conclusion === 'success';
      if (bucket) {
        if (passed) bucket.passed += 1;
        else if (failed) bucket.failed += 1;
      }
      if (weekStart && dayKey >= weekStart) {
        if (passed) weekPassed += 1;
        else if (failed) weekFailed += 1;
      }
    }

    history.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    return {
      ok: true,
      cliAvailable: true,
      authenticated: true,
      days,
      runs: history.slice(0, HISTORY_CAP),
      weekPassed,
      weekFailed,
      runningCount,
      repoCount: repos.length,
    };
  } catch (error) {
    const message = ghErrorMessage(error);
    const unauthenticated = /401|403|HTTP 401|Bad credentials|not logged in|auth/i.test(message);
    return emptyActivity({
      ok: false,
      cliAvailable: true,
      authenticated: !unauthenticated,
      error: unauthenticated
        ? 'Not signed in to the GitHub CLI. Run "gh auth login" first.'
        : message,
    });
  }
}

export async function listWorkflowRuns(
  owner: string,
  repo: string,
  workflowId: number,
  perPage = 5,
): Promise<GithubWorkflowRunInfo[]> {
  const payload = await ghApi<{ workflow_runs?: GhRun[] }>(
    `repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=${perPage}`,
  );
  return (payload.workflow_runs ?? []).map(toWorkflowRun);
}

export async function fetchProjectPipelineStatus(project: Project): Promise<ProjectPipelineStatus> {
  const empty: ProjectPipelineStatus = {
    projectId: project.id,
    cliAvailable: false,
    authenticated: false,
    github: null,
    workflows: [],
    runsByWorkflowId: {},
  };

  const github = await githubRepoForFolder(project.folderPath);
  if (!github) {
    return { ...empty, error: 'This repository is not connected to GitHub.' };
  }

  if (!(await isGhCliAvailable())) {
    return {
      ...empty,
      github,
      error: 'Install the GitHub CLI and sign in to watch Actions on this repo.',
    };
  }

  try {
    const [workflowPayload, runPayload] = await Promise.all([
      ghApi<{ workflows?: GhWorkflow[] }>(
        `repos/${github.owner}/${github.repo}/actions/workflows?per_page=100`,
      ),
      ghApi<{ workflow_runs?: GhRun[] }>(
        `repos/${github.owner}/${github.repo}/actions/runs?per_page=40`,
      ),
    ]);

    const workflows = (workflowPayload.workflows ?? [])
      .filter((item) => item.state !== 'deleted')
      .map(toWorkflow);

    const runsByWorkflowId: Record<number, GithubWorkflowRunInfo | null> = {};
    for (const workflow of workflows) runsByWorkflowId[workflow.id] = null;
    for (const run of runPayload.workflow_runs ?? []) {
      if (runsByWorkflowId[run.workflow_id] == null) {
        runsByWorkflowId[run.workflow_id] = toWorkflowRun(run);
      }
    }

    return {
      projectId: project.id,
      cliAvailable: true,
      authenticated: true,
      github,
      workflows,
      runsByWorkflowId,
    };
  } catch (error) {
    const message = ghErrorMessage(error);
    const unauthenticated = /401|403|HTTP 401|Bad credentials|not logged in|auth/i.test(message);
    return {
      ...empty,
      cliAvailable: true,
      authenticated: !unauthenticated,
      github,
      error: unauthenticated
        ? 'Not signed in to the GitHub CLI. Run "gh auth login" first.'
        : message,
    };
  }
}

export async function setProjectWatchedActions(
  projectId: string,
  actions: ProjectGithubAction[],
): Promise<Project> {
  const projects = await store.getProjects();
  const index = projects.findIndex((item) => item.id === projectId);
  if (index === -1) throw new Error(`Project ${projectId} not found`);
  const updated: Project = {
    ...projects[index],
    githubActions: normalizeProjectGithubActions(actions),
    updatedAt: new Date().toISOString(),
  };
  projects[index] = updated;
  await store.setProjects(projects);
  return updated;
}
