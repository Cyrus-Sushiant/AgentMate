import type { ProjectDraft } from '@agentmat/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import {
  expectChannelsCovered,
  invoke,
  loadIpc,
  useTempUserData,
} from '../../test/main/ipcHarness';

/**
 * Drafts belong to a project, so the listing has to stay scoped to the one that asked: a leak
 * would show one project's plans inside another. The status field also carries a date, and
 * reopening a draft has to drop it rather than leave it claiming a day it was never finished on.
 */

useTempUserData();
expectChannelsCovered(IPC.projectDrafts);

async function register(): Promise<void> {
  await loadIpc(
    () => import('./projectDrafts'),
    (module) => module.registerProjectDraftHandlers(),
  );
}

function draftInput(projectId: string, rawInput = 'add login') {
  return {
    projectId,
    rawInput,
    promptType: 'Full Stack',
    targetAI: 'Claude Code',
    content: `plan for ${rawInput}`,
  };
}

beforeEach(async () => {
  await register();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('project drafts', () => {
  it('starts a project with no drafts', async () => {
    await expect(invoke(IPC.projectDrafts.listByProject, 'p1')).resolves.toEqual([]);
  });

  it('creates a draft that starts unimplemented', async () => {
    const draft = await invoke<ProjectDraft>(IPC.projectDrafts.create, draftInput('p1'));

    expect(draft).toMatchObject({
      projectId: 'p1',
      rawInput: 'add login',
      status: 'draft',
      implementedAt: null,
    });
    expect(draft.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('lists only the drafts of the project that asked', async () => {
    await invoke(IPC.projectDrafts.create, draftInput('p1', 'first'));
    await invoke(IPC.projectDrafts.create, draftInput('p2', 'other project'));
    await invoke(IPC.projectDrafts.create, draftInput('p1', 'second'));

    const listed = await invoke<ProjectDraft[]>(IPC.projectDrafts.listByProject, 'p1');

    expect(listed.map((one) => one.rawInput)).toEqual(['first', 'second']);
  });

  it('stamps the date a draft was marked implemented', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T10:00:00.000Z'));
    const draft = await invoke<ProjectDraft>(IPC.projectDrafts.create, draftInput('p1'));

    await invoke(IPC.projectDrafts.updateStatus, draft.id, 'implemented');

    const [stored] = await invoke<ProjectDraft[]>(IPC.projectDrafts.listByProject, 'p1');
    expect(stored.status).toBe('implemented');
    expect(stored.implementedAt).toBe('2026-09-18T10:00:00.000Z');
  });

  it('clears the date again when a draft is reopened', async () => {
    const draft = await invoke<ProjectDraft>(IPC.projectDrafts.create, draftInput('p1'));
    await invoke(IPC.projectDrafts.updateStatus, draft.id, 'implemented');

    await invoke(IPC.projectDrafts.updateStatus, draft.id, 'draft');

    const [stored] = await invoke<ProjectDraft[]>(IPC.projectDrafts.listByProject, 'p1');
    expect(stored.status).toBe('draft');
    expect(stored.implementedAt).toBeNull();
  });

  it('ignores a status change for a draft that is gone', async () => {
    await invoke(IPC.projectDrafts.create, draftInput('p1'));

    await expect(
      invoke(IPC.projectDrafts.updateStatus, 'no-such-id', 'implemented'),
    ).resolves.toBeUndefined();

    const listed = await invoke<ProjectDraft[]>(IPC.projectDrafts.listByProject, 'p1');
    expect(listed).toHaveLength(1);
    expect(listed[0]?.status).toBe('draft');
  });

  it('removes one draft and leaves the rest, in every project', async () => {
    const doomed = await invoke<ProjectDraft>(IPC.projectDrafts.create, draftInput('p1', 'doomed'));
    await invoke(IPC.projectDrafts.create, draftInput('p1', 'kept'));
    await invoke(IPC.projectDrafts.create, draftInput('p2', 'elsewhere'));

    await invoke(IPC.projectDrafts.remove, doomed.id);

    const mine = await invoke<ProjectDraft[]>(IPC.projectDrafts.listByProject, 'p1');
    const theirs = await invoke<ProjectDraft[]>(IPC.projectDrafts.listByProject, 'p2');
    expect(mine.map((one) => one.rawInput)).toEqual(['kept']);
    expect(theirs).toHaveLength(1);
  });

  it('keeps drafts across a restart', async () => {
    await invoke(IPC.projectDrafts.create, draftInput('p1', 'survives'));

    await register();

    const listed = await invoke<ProjectDraft[]>(IPC.projectDrafts.listByProject, 'p1');
    expect(listed.map((one) => one.rawInput)).toEqual(['survives']);
  });
});
