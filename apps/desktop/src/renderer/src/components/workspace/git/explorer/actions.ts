import {
  baseName,
  isSameOrInside,
  type Project,
  parentPath,
  relativeTo,
  topLevelPaths,
} from '@agentmat/core';
import type { DirectoryEntry, ExplorerMove } from '@shared/apiTypes';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { launchShellTab } from '@/lib/workspace/launch';
import { queryClient } from '@/queryClient';
import { confirmDialog } from '@/stores/confirmStore';
import {
  explorerProject,
  forgetExplorerPaths,
  patchExplorer,
  remapExplorerPaths,
  selectRows,
  setFolderOpen,
  useExplorerStore,
} from '@/stores/explorerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { trashName } from './keys';

/** Electron prefixes rejected IPC calls with "Error invoking remote method '...': Error: ". */
function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  return (
    raw
      .replace(/^Error invoking remote method '[^']*':\s*/, '')
      .replace(/^Error:\s*/, '')
      .trim() || 'Something went wrong.'
  );
}

function fail(title: string, error: unknown): void {
  toast.error(title, { description: errorText(error) });
}

export function projectRoot(project: Project): string {
  return project.folderPath.replace(/[\\/]+$/, '');
}

function refreshTree(projectId: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.workspaceExplorer(projectId) });
}

/** Opens every folder between the project root and `path`, so a new or pasted row is visible. */
function revealRow(project: Project, path: string): void {
  const root = projectRoot(project);
  let folder = parentPath(path);
  while (folder && isSameOrInside(folder, root) && folder !== root) {
    setFolderOpen(project.id, folder, true);
    folder = parentPath(folder);
  }
}

/** The entries already listed in a folder, from the tree's cache. */
export function cachedListing(projectId: string, dir: string): DirectoryEntry[] {
  return (
    queryClient.getQueryData<DirectoryEntry[]>(queryKeys.workspaceExplorerDir(projectId, dir)) ?? []
  );
}

/** Moves open tabs, cached file contents and the tree's memory of a path to where it went. */
function followMoves(projectId: string, moves: ExplorerMove[]): void {
  const workspace = useWorkspaceStore.getState();
  for (const { from, to } of moves) {
    for (const tab of Object.values(workspace.workspaces[projectId]?.tabs ?? {})) {
      if (tab.kind !== 'file' || !isSameOrInside(tab.path, from)) continue;
      const next = to + tab.path.slice(from.replace(/[\\/]+$/, '').length);
      const data = queryClient.getQueryData(queryKeys.workspaceFile(tab.path));
      if (data !== undefined) queryClient.setQueryData(queryKeys.workspaceFile(next), data);
    }
    workspace.retargetFileTabs(projectId, from, to);
    remapExplorerPaths(projectId, from, to);
  }
}

/** The folder a paste or "New File" lands in: the focused folder, or the focused file's folder. */
export function targetFolder(project: Project, path: string | null, isDirectory: boolean): string {
  if (!path) return projectRoot(project);
  return isDirectory ? path : (parentPath(path) ?? projectRoot(project));
}

export function startCreate(project: Project, kind: 'newFile' | 'newFolder', parent: string): void {
  const root = projectRoot(project);
  if (parent !== root) {
    revealRow(project, parent);
    setFolderOpen(project.id, parent, true);
  }
  patchExplorer(project.id, { editing: { kind, parent } });
}

/** "New File" from the panel header: inside the focused folder, or beside the focused file. */
export function startCreateAtFocus(project: Project, kind: 'newFile' | 'newFolder'): void {
  const { focused } = explorerProject(project.id);
  const row = focused
    ? Array.from(document.querySelectorAll<HTMLElement>('[data-explorer-row]')).find(
        (element) => element.dataset.explorerPath === focused,
      )
    : undefined;
  const parent = row
    ? targetFolder(project, focused, row.dataset.dir === 'true')
    : projectRoot(project);
  startCreate(project, kind, parent);
}

export async function createEntry(
  project: Project,
  kind: 'newFile' | 'newFolder',
  parent: string,
  name: string,
): Promise<boolean> {
  try {
    const api = window.agentmat.explorer;
    const path =
      kind === 'newFile'
        ? await api.createFile(project.id, parent, name)
        : await api.createFolder(project.id, parent, name);
    revealRow(project, path);
    await refreshTree(project.id);
    selectRows(project.id, [path], { focus: kind === 'newFolder' || /[\\/]$/.test(name) });
    if (kind === 'newFile' && !/[\\/]$/.test(name)) {
      useWorkspaceStore.getState().openFile(project.id, path, { pin: true });
    }
    return true;
  } catch (error) {
    fail(kind === 'newFile' ? 'Could not create the file' : 'Could not create the folder', error);
    return false;
  }
}

export async function renameEntry(
  project: Project,
  path: string,
  newName: string,
): Promise<boolean> {
  if (newName === baseName(path)) return true;
  try {
    const next = await window.agentmat.explorer.rename(project.id, path, newName);
    followMoves(project.id, [{ from: path, to: next }]);
    await refreshTree(project.id);
    selectRows(project.id, [next], { focus: true });
    return true;
  } catch (error) {
    fail('Could not rename', error);
    return false;
  }
}

function listNames(paths: string[]): string {
  const names = paths.slice(0, 10).map((path) => baseName(path));
  const more = paths.length > 10 ? `\nand ${paths.length - 10} more` : '';
  return `${names.join('\n')}${more}`;
}

/** Deletes after asking, to the trash unless `permanent`. True when anything was deleted. */
export async function deleteEntries(
  project: Project,
  paths: string[],
  options: { permanent: boolean },
): Promise<boolean> {
  const targets = topLevelPaths(paths).filter((path) => path !== projectRoot(project));
  if (targets.length === 0) return false;
  const dirty = Object.keys(useExplorerStore.getState().dirtyFiles).filter((file) =>
    targets.some((target) => isSameOrInside(file, target)),
  );
  const single = targets.length === 1;
  const subject = single ? `"${baseName(targets[0] as string)}"` : `${targets.length} items`;
  const restoreNote = options.permanent
    ? "This can't be undone."
    : `You can restore ${single ? 'it' : 'them'} from the ${trashName()}.`;
  const dirtyNote =
    dirty.length > 0
      ? ` ${dirty.length === 1 ? 'One open file has' : `${dirty.length} open files have`} unsaved changes that will be lost.`
      : '';
  const confirmed = await confirmDialog({
    title: options.permanent ? `Permanently delete ${subject}?` : `Delete ${subject}?`,
    description: `${single ? '' : `${listNames(targets)}\n\n`}${restoreNote}${dirtyNote}`,
    confirmLabel: options.permanent ? 'Delete permanently' : `Move to ${trashName()}`,
    variant: 'destructive',
  });
  if (!confirmed) return false;

  let deleted = targets;
  try {
    const result = await window.agentmat.explorer.delete(project.id, targets, options);
    if (result.failed.length > 0) {
      const again = await confirmDialog({
        title: `Could not move ${result.failed.length === 1 ? `"${baseName(result.failed[0] as string)}"` : `${result.failed.length} items`} to the ${trashName()}`,
        description: "Delete permanently instead? This can't be undone.",
        confirmLabel: 'Delete permanently',
        variant: 'destructive',
      });
      if (again) {
        await window.agentmat.explorer.delete(project.id, result.failed, { permanent: true });
      } else {
        deleted = targets.filter((path) => !result.failed.includes(path));
      }
    }
  } catch (error) {
    fail('Could not delete', error);
    await refreshTree(project.id);
    return false;
  }
  useWorkspaceStore.getState().closeFileTabsUnder(project.id, deleted);
  forgetExplorerPaths(project.id, deleted);
  await refreshTree(project.id);
  return deleted.length > 0;
}

export function copyToClipboard(project: Project, paths: string[], mode: 'copy' | 'cut'): void {
  const top = topLevelPaths(paths).filter((path) => path !== projectRoot(project));
  if (top.length === 0) return;
  useExplorerStore.setState({ clipboard: { mode, projectId: project.id, paths: top } });
}

/** Copies or moves entries into a folder, asking before a move replaces anything. */
export async function transferEntries(
  project: Project,
  sources: string[],
  target: string,
  mode: 'copy' | 'move',
): Promise<boolean> {
  const api = window.agentmat.explorer;
  try {
    let result =
      mode === 'copy'
        ? await api.copy(project.id, sources, target)
        : await api.move(project.id, sources, target, { overwrite: false });
    if (result.conflicts.length > 0) {
      const [first] = result.conflicts;
      const replace = await confirmDialog({
        title:
          result.conflicts.length === 1
            ? `"${first}" already exists in "${baseName(target)}"`
            : `${result.conflicts.length} items already exist in "${baseName(target)}"`,
        description:
          result.conflicts.length === 1
            ? 'Do you want to replace it? The file that is there now goes to the ' +
              `${trashName()}.`
            : `${listNames(result.conflicts)}\n\nDo you want to replace them? The files there now go to the ${trashName()}.`,
        confirmLabel: 'Replace',
        variant: 'destructive',
      });
      if (!replace) return false;
      result = await api.move(project.id, sources, target, { overwrite: true });
    }
    if (mode === 'move') followMoves(project.id, result.moves);
    if (target !== projectRoot(project)) setFolderOpen(project.id, target, true);
    await refreshTree(project.id);
    const landed = result.moves.map((move) => move.to);
    if (landed.length > 0) selectRows(project.id, landed, { focus: true });
    return true;
  } catch (error) {
    fail(mode === 'copy' ? 'Could not copy' : 'Could not move', error);
    await refreshTree(project.id);
    return false;
  }
}

export async function pasteInto(project: Project, target: string): Promise<void> {
  const clipboard = useExplorerStore.getState().clipboard;
  if (!clipboard) return;
  if (clipboard.projectId !== project.id) {
    toast.error('Paste works inside the project the files were copied from.');
    return;
  }
  const done = await transferEntries(
    project,
    clipboard.paths,
    target,
    clipboard.mode === 'cut' ? 'move' : 'copy',
  );
  // A cut moves once; a copy can be pasted again.
  if (done && clipboard.mode === 'cut') useExplorerStore.setState({ clipboard: null });
}

export function copyPaths(project: Project, paths: string[], relative: boolean): void {
  const separator = window.agentmat.platform === 'win32' ? '\\' : '/';
  const text = paths
    .map((path) => {
      if (!relative) return path;
      const rel = relativeTo(projectRoot(project), path);
      return rel === null ? path : rel.replaceAll('/', separator) || '.';
    })
    .join('\n');
  void navigator.clipboard.writeText(text).then(
    () => toast.success(paths.length === 1 ? 'Path copied' : `${paths.length} paths copied`),
    (error) => fail('Could not copy the path', error),
  );
}

export function revealInOs(project: Project, path: string): void {
  void window.agentmat.explorer
    .revealInOs(project.id, path)
    .catch((error) => fail('Could not open the folder', error));
}

export function openInTerminal(project: Project, path: string, isDirectory: boolean): void {
  launchShellTab(project, undefined, undefined, targetFolder(project, path, isDirectory));
}

export function openToSide(project: Project, path: string): void {
  const store = useWorkspaceStore.getState();
  const ws = store.workspaces[project.id];
  if (!ws) return;
  store.splitGroup(project.id, ws.focusedGroupId, 'row');
  store.openFile(project.id, path, { pin: true });
}

/**
 * Adds rows to the repository's root .gitignore: each path on its own line, or with
 * `extension`, every file sharing the first path's extension. Paths git still tracks are
 * offered a "Stop tracking" action, since ignoring alone does not untrack them.
 */
export async function addToGitignore(
  project: Project,
  paths: string[],
  pattern: 'path' | 'extension',
): Promise<void> {
  const api = window.agentmat.explorer;
  const targets = pattern === 'extension' ? paths.slice(0, 1) : topLevelPaths(paths);
  const lines: string[] = [];
  const tracked: string[] = [];
  let added = 0;
  try {
    // One at a time: every call rewrites the same .gitignore.
    for (const path of targets) {
      const result = await api.addToGitignore(project.id, path, pattern);
      lines.push(result.line);
      if (result.added) added += 1;
      if (result.tracked && pattern === 'path') tracked.push(path);
    }
  } catch (error) {
    fail('Could not update .gitignore', error);
  } finally {
    await refreshTree(project.id);
  }
  if (lines.length === 0) return;

  const message =
    lines.length === 1
      ? added === 1
        ? `Added ${lines[0]} to .gitignore`
        : `${lines[0]} is already in .gitignore`
      : `Added ${added} of ${lines.length} entries to .gitignore`;
  if (tracked.length === 0) {
    toast.success(message);
    return;
  }
  const subject =
    tracked.length === 1 ? `"${baseName(tracked[0] as string)}"` : `${tracked.length} of them`;
  toast.message(message, {
    description: `Git still tracks ${subject}, so its changes keep showing until it is untracked.`,
    duration: 10_000,
    action: {
      label: 'Stop tracking',
      onClick: () => {
        void (async () => {
          try {
            for (const path of tracked) await api.untrack(project.id, path);
            toast.success(
              tracked.length === 1
                ? `Stopped tracking ${baseName(tracked[0] as string)}. It stays on disk.`
                : `Stopped tracking ${tracked.length} items. They stay on disk.`,
            );
          } catch (error) {
            fail('Could not stop tracking', error);
          } finally {
            void refreshTree(project.id);
          }
        })();
      },
    },
  });
}

export function collapseAll(projectId: string): void {
  patchExplorer(projectId, { open: {} });
}

/** Rows the keyboard commands act on: the selection, when the focused row is part of it. */
export function commandTargets(projectId: string): string[] {
  const { selected, focused } = explorerProject(projectId);
  if (focused && !selected.includes(focused)) return [focused];
  return selected.length > 0 ? selected : focused ? [focused] : [];
}
