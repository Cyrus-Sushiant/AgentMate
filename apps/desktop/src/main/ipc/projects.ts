import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { dialog, ipcMain } from 'electron';
import { defaultProjectNotifications, getBootstrapPlan } from '@agentmat/core';
import type {
  BootstrapPlan,
  DetectedClaudeHook,
  Project,
  ProjectNotificationSettings,
} from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { BootstrapResult, CreateProjectInput } from '../../shared/apiTypes';
import { store, logActivity } from '../store';
import {
  deleteClaudeHook,
  installProjectNotificationHooks,
  listClaudeHooks,
  updateClaudeHook,
} from '../notifications/hookInstaller';

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
        runCommand: input.runCommand,
        notifications: defaultProjectNotifications(),
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
      const projects = await store.getProjects();
      const index = projects.findIndex((p) => p.id === projectId);
      if (index === -1) throw new Error(`Project ${projectId} not found`);
      const updated: Project = {
        ...projects[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      projects[index] = updated;
      await store.setProjects(projects);
      return updated;
    },
  );

  ipcMain.handle(
    IPC.projects.updateNotifications,
    async (_event, projectId: string, notifications: ProjectNotificationSettings): Promise<Project> => {
      const projects = await store.getProjects();
      const index = projects.findIndex((p) => p.id === projectId);
      if (index === -1) throw new Error(`Project ${projectId} not found`);
      const updated: Project = { ...projects[index], notifications, updatedAt: new Date().toISOString() };
      projects[index] = updated;
      await store.setProjects(projects);
      await installProjectNotificationHooks(updated);
      return updated;
    },
  );

  ipcMain.handle(IPC.projects.delete, async (_event, projectId: string): Promise<void> => {
    const projects = await store.getProjects();
    await store.setProjects(projects.filter((p) => p.id !== projectId));
  });

  /**
   * The plan the Bootstrap tab previews. Served from here — rather than
   * recomputed in the renderer — so the preview and the write can never
   * disagree: both come from this process, off the same build.
   */
  ipcMain.handle(
    IPC.projects.bootstrapPlan,
    async (_event, projectId: string): Promise<BootstrapPlan> => {
      const projects = await store.getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error(`Project ${projectId} not found`);
      return planFor(project);
    },
  );

  ipcMain.handle(
    IPC.projects.bootstrap,
    async (_event, projectId: string): Promise<BootstrapResult> => {
      const projects = await store.getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error(`Project ${projectId} not found`);

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
      const projects = await store.getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error(`Project ${projectId} not found`);
      return listClaudeHooks(project.folderPath);
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
      const projects = await store.getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error(`Project ${projectId} not found`);
      await updateClaudeHook(project.folderPath, hookId, updates);
    },
  );

  ipcMain.handle(
    IPC.projects.deleteClaudeHook,
    async (_event, projectId: string, hookId: string): Promise<void> => {
      const projects = await store.getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error(`Project ${projectId} not found`);
      await deleteClaudeHook(project.folderPath, hookId);
    },
  );

  ipcMain.handle(IPC.projects.pickFolder, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}
