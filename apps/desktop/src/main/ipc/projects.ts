import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dialog, ipcMain } from 'electron';
import { BOOTSTRAP_FOLDERS, defaultProjectNotifications, getBootstrapFiles } from '@agentmat/core';
import type { Project, ProjectNotificationSettings } from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type { CreateProjectInput } from '../../shared/apiTypes';
import { store, logActivity } from '../store';
import { installProjectNotificationHooks } from '../notifications/hookInstaller';

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

  ipcMain.handle(
    IPC.projects.bootstrap,
    async (_event, projectId: string): Promise<{ createdFiles: string[] }> => {
      const projects = await store.getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error(`Project ${projectId} not found`);

      for (const folder of BOOTSTRAP_FOLDERS) {
        await mkdir(join(project.folderPath, folder), { recursive: true });
      }

      const files = getBootstrapFiles({
        name: project.name,
        description: project.description,
        agentType: project.agentType,
      });

      const createdFiles: string[] = [];
      for (const file of files) {
        const targetPath = join(project.folderPath, file.relativePath);
        await writeFile(targetPath, file.content, { flag: 'wx' }).catch((error) => {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        });
        createdFiles.push(file.relativePath);
      }

      await logActivity('project-bootstrapped', `Bootstrapped project "${project.name}"`, {
        projectId,
      });

      return { createdFiles };
    },
  );

  ipcMain.handle(IPC.projects.pickFolder, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}
