import { randomUUID } from 'node:crypto';
import type { Project } from '@agentmat/core';
import { configuredRunCommands, normalizeProjectRunCommands } from '@agentmat/core';
import type {
  RunProposal,
  RunProposalDecision,
  RunProposalResult,
  RunProposalsChanged,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { broadcastToWindows } from '../ipc/send';
import { store } from '../store';
import { bridgeScriptSource } from './bridgeScript';
import { disableRunProposals, enableRunProposals, isRunProposalsEnabled } from './mcpConfig';
import { validateRunProposal } from './validate';

/** More than this waiting for one project is a loop, not a plan, so the agent is told to stop. */
const MAX_WAITING_PER_PROJECT = 10;

/**
 * Suggestions waiting for the user. Kept in memory on purpose: one nobody answered is dropped when
 * AgentMate quits, so a stale suggestion never comes back on its own.
 */
const pending = new Map<string, RunProposal>();

export interface RunCommandsResponse {
  status: number;
  payload: Record<string, unknown>;
}

export function listPendingRunProposals(): RunProposal[] {
  return [...pending.values()];
}

function announce(): void {
  const changed: RunProposalsChanged = { pending: listPendingRunProposals() };
  broadcastToWindows(IPC.runProposals.onChanged, changed);
}

async function findProject(projectId: string): Promise<Project | undefined> {
  const projects = await store.getProjects();
  return projects.find((project) => project.id === projectId);
}

function failure(status: number, error: string): RunCommandsResponse {
  return { status, payload: { ok: false, error } };
}

export async function getRunProposalsEnabled(projectId: string): Promise<boolean> {
  const project = await findProject(projectId);
  return project ? isRunProposalsEnabled(project.folderPath) : false;
}

/**
 * Answers one request from a project's bridge. The HTTP layer has already checked the token, so
 * this only decides what the project may do. Nothing here saves a command: a suggestion waits.
 */
export async function handleRunCommandsRequest(body: unknown): Promise<RunCommandsResponse> {
  const request = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const projectId = typeof request.projectId === 'string' ? request.projectId : '';
  const project = projectId ? await findProject(projectId) : undefined;
  if (!project) return failure(404, 'AgentMate does not know this project.');
  if (!(await isRunProposalsEnabled(project.folderPath))) {
    return failure(
      403,
      'Run suggestions are off for this project. Turn them on in its MCP section.',
    );
  }
  if (request.action === 'list') {
    const commands = configuredRunCommands(project).map(({ label, command }) => ({
      label,
      command,
    }));
    return { status: 200, payload: { ok: true, commands } };
  }
  if (request.action === 'propose') return proposeRunCommand(project, request);
  return failure(400, 'Unknown action.');
}

async function proposeRunCommand(
  project: Project,
  request: Record<string, unknown>,
): Promise<RunCommandsResponse> {
  const checked = validateRunProposal(
    { label: request.label, command: request.command },
    project.runCommands,
  );
  if (!checked.ok) return failure(400, checked.error);

  const waiting = listPendingRunProposals().filter((item) => item.projectId === project.id);
  if (waiting.some((item) => item.command === checked.command)) {
    return failure(409, 'AgentMate is already waiting for your approval of that command.');
  }
  if (waiting.length >= MAX_WAITING_PER_PROJECT) {
    return failure(429, 'Too many suggestions are waiting. Review them in AgentMate first.');
  }

  const proposal: RunProposal = {
    id: randomUUID(),
    projectId: project.id,
    projectName: project.name,
    label: checked.label,
    command: checked.command,
    proposedAt: new Date().toISOString(),
  };
  pending.set(proposal.id, proposal);
  announce();

  const named = proposal.label ? `"${proposal.label}"` : 'the command';
  return {
    status: 200,
    payload: {
      ok: true,
      id: proposal.id,
      message: `Suggested ${named} for ${project.name}. It waits for the user to approve it in AgentMate. Nothing runs until they approve it and press Run.`,
    },
  };
}

/** Adds an approved suggestion to its project. Returns the reason it could not be added, if any. */
async function addRunCommand(proposal: RunProposal): Promise<string | null> {
  const projects = await store.getProjects();
  const index = projects.findIndex((project) => project.id === proposal.projectId);
  if (index === -1) return 'That project no longer exists.';
  const project = projects[index];
  // Checked again: the project may have gained the same command since the suggestion was made.
  const checked = validateRunProposal(
    { label: proposal.label, command: proposal.command },
    project.runCommands,
  );
  if (!checked.ok) return checked.error;
  projects[index] = {
    ...project,
    runCommands: normalizeProjectRunCommands({
      runCommands: [
        ...project.runCommands,
        { id: randomUUID(), label: checked.label, command: checked.command },
      ],
    }),
    updatedAt: new Date().toISOString(),
  };
  await store.setProjects(projects);
  return null;
}

export async function decideRunProposal(
  id: string,
  decision: RunProposalDecision,
): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const proposal = pending.get(id);
  if (!proposal) return { ok: false, error: 'That suggestion is no longer waiting.' };
  pending.delete(id);
  const error = decision === 'add' ? await addRunCommand(proposal) : null;
  announce();
  if (error) return { ok: false, error };
  return { ok: true, projectId: proposal.projectId };
}

/**
 * Switches the feature on or off for one project. Switching off also drops that project's waiting
 * suggestions, so nothing can be approved after the user has turned the feature off.
 */
export async function setRunProposalsEnabled(
  projectId: string,
  enabled: boolean,
  portFile: string,
): Promise<RunProposalResult> {
  const project = await findProject(projectId);
  if (!project) return { ok: false, error: 'AgentMate does not know this project.' };
  try {
    if (enabled) {
      await enableRunProposals(project.folderPath, bridgeScriptSource({ portFile, projectId }));
    } else {
      await disableRunProposals(project.folderPath);
      for (const item of listPendingRunProposals()) {
        if (item.projectId === projectId) pending.delete(item.id);
      }
      announce();
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Could not change run suggestions for this project.',
    };
  }
}
