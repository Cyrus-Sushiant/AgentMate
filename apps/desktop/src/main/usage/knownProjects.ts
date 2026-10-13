import { store } from '../store';
import type { KnownProjects } from './projectDaily';

/**
 * The projects and their git worktrees, as the per-project split needs them. Only the fields that
 * name a folder are kept; icons and everything else stay where they are.
 */
export async function loadKnownProjects(): Promise<KnownProjects> {
  const [projects, worktrees] = await Promise.all([store.getProjects(), store.getWorktrees()]);
  return {
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      folderPath: project.folderPath,
    })),
    worktrees: worktrees.map((worktree) => ({
      projectId: worktree.projectId,
      path: worktree.path,
    })),
  };
}
