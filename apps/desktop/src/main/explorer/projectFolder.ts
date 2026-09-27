import { resolve } from 'node:path';
import { findProjectScope } from '../worktrees/resolve';

/**
 * The folder behind a project id from the renderer. A worktree's workspace passes its scope
 * id and gets the worktree's folder. The renderer never names a folder itself, so whatever it
 * asks for stays inside a project the app knows about.
 */
export async function projectFolder(projectId: unknown): Promise<string> {
  const project = typeof projectId === 'string' ? await findProjectScope(projectId) : null;
  if (!project) throw new Error('That project no longer exists.');
  return resolve(project.folderPath);
}
