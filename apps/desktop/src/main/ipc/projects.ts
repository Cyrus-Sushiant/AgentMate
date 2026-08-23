import { randomUUID } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  BootstrapPlan,
  DetectedClaudeHook,
  Project,
  ProjectNotificationSettings,
} from '@agentmat/core';
import {
  defaultProjectNotifications,
  getBootstrapPlan,
  normalizeProjectColor,
  normalizeProjectRunCommands,
} from '@agentmat/core';
import { dialog, ipcMain } from 'electron';
import type { BootstrapResult, CreateProjectInput, FaviconResult } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import {
  deleteClaudeHook,
  installProjectNotificationHooks,
  listClaudeHooks,
  updateClaudeHook,
} from '../notifications/hookInstaller';
import {
  fetchSiteFavicon,
  ICON_FILE_EXTENSIONS,
  normalizeIconDataUrl,
  readIconFile,
} from '../projectIcons';
import { logActivity, store } from '../store';

/**
 * The folder the user set as their projects root, if it is still there. A path
 * that has since been moved or deleted is dropped so the dialog falls back to
 * the OS default instead of opening on nothing.
 */
async function projectsRootPath(): Promise<string | null> {
  const { projectsRootPath: root } = await store.getSettings();
  if (!root) return null;
  try {
    const info = await stat(root);
    return info.isDirectory() ? root : null;
  } catch {
    return null;
  }
}

async function requireProject(projectId: string): Promise<Project> {
  const projects = await store.getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project;
}

/**
 * Applies `mutate` to one project and persists the whole list. `updatedAt` is
 * stamped here so no caller can forget it.
 */
async function mutateProject(
  projectId: string,
  mutate: (current: Project) => Project,
): Promise<Project> {
  const projects = await store.getProjects();
  const index = projects.findIndex((p) => p.id === projectId);
  if (index === -1) throw new Error(`Project ${projectId} not found`);
  const updated: Project = { ...mutate(projects[index]), updatedAt: new Date().toISOString() };
  projects[index] = updated;
  await store.setProjects(projects);
  return updated;
}

function planFor(project: Project): BootstrapPlan {
  return getBootstrapPlan({
    name: project.name,
    description: project.description,
    agentType: project.agentType,
  });
}

export function registerProjectHandlers(): void {
  ipcMain.handle(IPC.projects.list, (): Promise<Project[]> => store.getProjects());

  ipcMain.handle(
    IPC.projects.create,
    async (_event, input: CreateProjectInput): Promise<Project> => {
      const now = new Date().toISOString();
      const project: Project = {
        id: randomUUID(),
        name: input.name,
        folderPath: input.folderPath,
        description: input.description,
        tags: input.tags,
        agentType: input.agentType,
        notes: input.notes,
        runCommands: normalizeProjectRunCommands(input),
        prompt: input.prompt ?? '',
        notifications: defaultProjectNotifications(),
        cliId: input.cliId ?? null,
        iconDataUrl: input.iconDataUrl ?? null,
        iconFile: null,
        iconBgColor: normalizeProjectColor(input.iconBgColor),
        iconColor: normalizeProjectColor(input.iconColor),
        websiteUrl: input.websiteUrl ?? '',
        repoUrl: input.repoUrl ?? '',
        githubActions: [],
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      const projects = await store.getProjects();
      projects.unshift(project);
      await store.setProjects(projects);
      await logActivity('project-created', `Created project "${project.name}"`, {
        projectId: project.id,
      });
      return project;
    },
  );

  ipcMain.handle(
    IPC.projects.update,
    async (_event, projectId: string, updates: Partial<CreateProjectInput>): Promise<Project> => {
      return mutateProject(projectId, (current) => ({
        ...current,
        ...updates,
        runCommands: updates.runCommands
          ? normalizeProjectRunCommands({ runCommands: updates.runCommands })
          : current.runCommands,
        // An update that says nothing about the colours leaves them alone; one
        // that does gets the same hex-only treatment a fresh project gets.
        iconBgColor:
          updates.iconBgColor === undefined
            ? current.iconBgColor
            : normalizeProjectColor(updates.iconBgColor),
        iconColor:
          updates.iconColor === undefined
            ? current.iconColor
            : normalizeProjectColor(updates.iconColor),
      }));
    },
  );

  ipcMain.handle(
    IPC.projects.updateNotifications,
    async (
      _event,
      projectId: string,
      notifications: ProjectNotificationSettings,
    ): Promise<Project> => {
      const updated = await mutateProject(projectId, (current) => ({ ...current, notifications }));
      await installProjectNotificationHooks(updated);
      return updated;
    },
  );

  ipcMain.handle(IPC.projects.delete, async (_event, projectId: string): Promise<void> => {
    const projects = await store.getProjects();
    await store.setProjects(projects.filter((p) => p.id !== projectId));
  });

  /**
   * `orderedIds` is every project id in its new display order (the Projects
   * page keeps pinned projects first, so this covers both groups at once).
   * Array order doubles as storage order, same as project creation.
   */
  ipcMain.handle(IPC.projects.reorder, async (_event, orderedIds: string[]): Promise<Project[]> => {
    const projects = await store.getProjects();
    const byId = new Map(projects.map((p) => [p.id, p]));
    const reordered = orderedIds.map((id) => byId.get(id)).filter((p): p is Project => p != null);
    const reorderedIds = new Set(reordered.map((p) => p.id));
    const missing = projects.filter((p) => !reorderedIds.has(p.id));
    const next = [...reordered, ...missing];
    await store.setProjects(next);
    return next;
  });

  ipcMain.handle(
    IPC.projects.setPinned,
    async (_event, projectId: string, pinned: boolean): Promise<Project> => {
      return mutateProject(projectId, (current) => ({ ...current, pinned }));
    },
  );

  /**
   * The plan the Bootstrap tab previews. Served from here instead of
   * recomputed in the renderer, so the preview and the write can never
   * disagree: both come from this process, off the same build.
   */
  ipcMain.handle(
    IPC.projects.bootstrapPlan,
    async (_event, projectId: string): Promise<BootstrapPlan> => {
      return planFor(await requireProject(projectId));
    },
  );

  ipcMain.handle(
    IPC.projects.bootstrap,
    async (_event, projectId: string): Promise<BootstrapResult> => {
      const project = await requireProject(projectId);
      const plan = planFor(project);

      for (const folder of plan.folders) {
        await mkdir(join(project.folderPath, folder), { recursive: true });
      }

      // Never clobber an agent's existing config: `wx` fails on EEXIST, which we
      // report back as "skipped" rather than counting as created.
      const createdFiles: string[] = [];
      const skippedFiles: string[] = [];
      for (const file of plan.files) {
        const targetPath = join(project.folderPath, file.relativePath);
        await mkdir(dirname(targetPath), { recursive: true });
        try {
          await writeFile(targetPath, file.content, { flag: 'wx' });
          createdFiles.push(file.relativePath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          skippedFiles.push(file.relativePath);
        }
      }

      await logActivity(
        'project-bootstrapped',
        `Bootstrapped project "${project.name}" for ${plan.agentLabel}`,
        { projectId },
      );

      return { agentLabel: plan.agentLabel, createdFiles, skippedFiles };
    },
  );

  ipcMain.handle(
    IPC.projects.listClaudeHooks,
    async (_event, projectId: string): Promise<DetectedClaudeHook[]> => {
      return listClaudeHooks((await requireProject(projectId)).folderPath);
    },
  );

  ipcMain.handle(
    IPC.projects.updateClaudeHook,
    async (
      _event,
      projectId: string,
      hookId: string,
      updates: { matcher?: string; hook: Record<string, unknown> },
    ): Promise<void> => {
      const project = await requireProject(projectId);
      await updateClaudeHook(project.folderPath, hookId, updates);
    },
  );

  ipcMain.handle(
    IPC.projects.deleteClaudeHook,
    async (_event, projectId: string, hookId: string): Promise<void> => {
      const project = await requireProject(projectId);
      await deleteClaudeHook(project.folderPath, hookId);
    },
  );

  ipcMain.handle(IPC.projects.pickFolder, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: (await projectsRootPath()) ?? undefined,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.projects.pickIcon, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ICON_FILE_EXTENSIONS }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return readIconFile(result.filePaths[0]);
  });

  ipcMain.handle(IPC.projects.normalizeIcon, (_event, dataUrl: string): string =>
    normalizeIconDataUrl(dataUrl),
  );

  ipcMain.handle(
    IPC.projects.fetchFavicon,
    (_event, siteUrl: string): Promise<FaviconResult | null> => fetchSiteFavicon(siteUrl),
  );
}
