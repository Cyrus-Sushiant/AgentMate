// @vitest-environment jsdom
import type { Project } from '@agentmat/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { currentBridge, installAgentmatBridge } from '../../../../../test/renderer/agentmatBridge';
import { openChangedFile } from './useWorkspaceGit';

/**
 * Where a row in the changes panel sends you. A file the app can show opens in a tab; anything
 * else is handed to the operating system, since the renderer only ever reads inside a project.
 */

const project = { id: 'p1', name: 'App', folderPath: 'E:\\work\\app' } as Project;
const openFile = vi.fn();

beforeEach(() => {
  installAgentmatBridge();
  openFile.mockClear();
  useWorkspaceStore.setState({ openFile } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openChangedFile', () => {
  it('opens a text file in an editor tab', () => {
    openChangedFile(project, '', 'src/index.ts', false);
    expect(openFile).toHaveBeenCalledWith('p1', 'E:\\work\\app\\src\\index.ts', { pin: true });
  });

  it('opens a binary image in the viewer rather than in another app', () => {
    openChangedFile(project, '', 'assets/logo.png', true);
    expect(openFile).toHaveBeenCalledWith('p1', 'E:\\work\\app\\assets\\logo.png', { pin: true });
    // $fn throws for a path the code never touched, which is the point: nothing was shelled out.
    expect(() => currentBridge().$fn('shell.openPath')).toThrow('has not been touched');
  });

  it('hands another binary file to its default app', () => {
    openChangedFile(project, '', 'dist/bundle.zip', true);
    expect(openFile).not.toHaveBeenCalled();
    expect(currentBridge().$fn('shell.openPath')).toHaveBeenCalledWith(
      'E:\\work\\app\\dist\\bundle.zip',
    );
  });

  it('hands over an image that sits outside the project folder', () => {
    // The project is a subfolder of the repository, so `docs/` is in the repo but not readable.
    openChangedFile(project, 'app', 'docs/logo.png', true);
    expect(openFile).not.toHaveBeenCalled();
    expect(currentBridge().$fn('shell.openPath')).toHaveBeenCalledWith('E:\\work\\docs\\logo.png');
  });

  it('opens an image inside the project even when the repository sits above it', () => {
    openChangedFile(project, 'app', 'app/assets/logo.png', true);
    expect(openFile).toHaveBeenCalledWith('p1', 'E:\\work\\app\\assets\\logo.png', { pin: true });
  });
});
