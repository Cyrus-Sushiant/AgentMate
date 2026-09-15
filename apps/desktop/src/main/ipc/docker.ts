import { ipcMain } from 'electron';
import type {
  DockerActionResult,
  DockerContainer,
  DockerRemoveOptions,
} from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import {
  isDockerAvailable,
  listContainers,
  listContainersForProject,
  removeContainer,
  restartContainer,
  startContainer,
  stopContainer,
} from '../docker/dockerCli';

export function registerDockerHandlers(): void {
  ipcMain.handle(IPC.docker.availability, (): Promise<boolean> => isDockerAvailable());

  ipcMain.handle(IPC.docker.list, (): Promise<DockerContainer[]> => listContainers());

  ipcMain.handle(
    IPC.docker.listForProject,
    (_event, folderPath: string): Promise<DockerContainer[]> =>
      listContainersForProject(folderPath),
  );

  ipcMain.handle(
    IPC.docker.start,
    (_event, id: string): Promise<DockerActionResult> => startContainer(id),
  );

  ipcMain.handle(
    IPC.docker.stop,
    (_event, id: string): Promise<DockerActionResult> => stopContainer(id),
  );

  ipcMain.handle(
    IPC.docker.restart,
    (_event, id: string): Promise<DockerActionResult> => restartContainer(id),
  );

  ipcMain.handle(
    IPC.docker.remove,
    (_event, id: string, options: DockerRemoveOptions): Promise<DockerActionResult> =>
      removeContainer(id, options),
  );
}
