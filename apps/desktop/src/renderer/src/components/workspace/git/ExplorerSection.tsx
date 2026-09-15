import { findGroup, type GitChangeStatus, type Project } from '@agentmat/core';
import type { DirectoryEntry, WorkspaceGitState } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { create } from 'zustand';
import { ChevronRight, File, Folder, FolderOpen } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { changeStatusMeta } from '@/lib/git';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** Folders that are huge and generated; shown, but dimmed, and never expanded on their own. */
const QUIET_FOLDERS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  'target',
]);
const HIDDEN = new Set(['.git']);

/** Which folders are open, per project, for as long as the app runs. */
const useExplorerState = create<{ open: Record<string, Record<string, boolean>> }>(() => ({
  open: {},
}));

export function explorerQueryKey(projectId: string, dir?: string): readonly unknown[] {
  return dir === undefined
    ? ['workspace-explorer', projectId]
    : ['workspace-explorer', projectId, dir];
}

function toRelative(root: string, path: string): string {
  return path
    .slice(root.length)
    .replace(/^[\\/]/, '')
    .replaceAll('\\', '/');
}

interface TreeContext {
  project: Project;
  root: string;
  statusByPath: Map<string, GitChangeStatus>;
  /** Folders holding a changed file, so a collapsed folder still hints at what is inside. */
  dirtyFolders: Set<string>;
  selectedPath: string | null;
}

function Directory({
  context,
  path,
  depth,
}: {
  context: TreeContext;
  path: string;
  depth: number;
}): React.JSX.Element {
  const { project } = context;
  const listing = useQuery({
    queryKey: explorerQueryKey(project.id, path),
    queryFn: () => window.agentmat.fs.listDirectory(path),
    meta: { silentLoading: true },
    staleTime: 30_000,
  });

  if (listing.isPending) {
    return (
      <div className="space-y-1 py-1" style={{ paddingLeft: depth * 12 + 22 }}>
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
      </div>
    );
  }
  if (listing.isError) {
    return (
      <p
        className="py-1 text-[11px] text-muted-foreground"
        style={{ paddingLeft: depth * 12 + 22 }}
      >
        Cannot read this folder.
      </p>
    );
  }
  return (
    <>
      {(listing.data ?? [])
        .filter((entry) => !HIDDEN.has(entry.name))
        .map((entry) => (
          <Entry key={entry.path} context={context} entry={entry} depth={depth} />
        ))}
    </>
  );
}

function Entry({
  context,
  entry,
  depth,
}: {
  context: TreeContext;
  entry: DirectoryEntry;
  depth: number;
}): React.JSX.Element {
  const { project, root, statusByPath, dirtyFolders, selectedPath } = context;
  const open = useExplorerState((s) => s.open[project.id]?.[entry.path] === true);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const relative = toRelative(root, entry.path);
  const quiet = entry.isDirectory && QUIET_FOLDERS.has(entry.name);
  const status = entry.isDirectory ? undefined : statusByPath.get(relative);
  const meta = status ? changeStatusMeta(status) : null;
  const dirty = entry.isDirectory && dirtyFolders.has(relative);

  const toggle = (): void =>
    useExplorerState.setState((s) => ({
      open: { ...s.open, [project.id]: { ...s.open[project.id], [entry.path]: !open } },
    }));

  return (
    <>
      <button
        type="button"
        onClick={() => (entry.isDirectory ? toggle() : openFile(project.id, entry.path))}
        onDoubleClick={() => {
          if (!entry.isDirectory) openFile(project.id, entry.path, { pin: true });
        }}
        aria-expanded={entry.isDirectory ? open : undefined}
        className={cn(
          'mx-1 flex h-[22px] w-[calc(100%-0.5rem)] items-center gap-1.5 rounded-md pr-2 text-left text-[12px] transition-colors hover:bg-foreground/[0.05]',
          selectedPath === entry.path && 'bg-primary/12',
          quiet && 'opacity-55',
        )}
        style={{ paddingLeft: depth * 12 + 6 }}
      >
        {entry.isDirectory ? (
          <ChevronRight
            className={cn(
              'h-2 w-2 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90',
            )}
          />
        ) : (
          <span className="w-2 shrink-0" />
        )}
        {entry.isDirectory ? (
          open ? (
            <FolderOpen className="h-3 w-3 shrink-0 text-primary/80" />
          ) : (
            <Folder className="h-3 w-3 shrink-0 text-primary/60" />
          )
        ) : (
          <File className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            meta?.className,
            status === 'D' && 'line-through',
            dirty && 'text-warning/90',
          )}
        >
          {entry.name}
        </span>
        {meta ? (
          <span className={cn('font-mono text-[10px] font-semibold', meta.className)}>
            {meta.letter}
          </span>
        ) : dirty ? (
          <span className="h-1.5 w-1.5 rounded-full bg-warning/80" />
        ) : null}
      </button>
      {entry.isDirectory && open ? (
        <Directory context={context} path={entry.path} depth={depth + 1} />
      ) : null}
    </>
  );
}

/** The project's files as a tree. Changed files carry their git status; a file opens in a tab. */
export function ExplorerSection({
  project,
  state,
}: {
  project: Project;
  state: WorkspaceGitState | undefined;
}): React.JSX.Element {
  const root = project.folderPath.replace(/[\\/]+$/, '');
  // The file showing in the focused pane is highlighted in the tree.
  const selectedPath = useWorkspaceStore((s) => {
    const ws = s.workspaces[project.id];
    if (!ws) return null;
    const group = findGroup(ws.root, ws.focusedGroupId);
    const tab = group?.activeTabId ? ws.tabs[group.activeTabId] : undefined;
    return tab?.kind === 'file' ? tab.path : null;
  });

  const context = useMemo<TreeContext>(() => {
    const statusByPath = new Map<string, GitChangeStatus>();
    const dirtyFolders = new Set<string>();
    const add = (path: string, status: GitChangeStatus): void => {
      if (!statusByPath.has(path) || status === 'U') statusByPath.set(path, status);
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i += 1) dirtyFolders.add(parts.slice(0, i).join('/'));
    };
    for (const entry of state?.conflicts ?? []) add(entry.path, 'U');
    for (const entry of [...(state?.unstaged ?? []), ...(state?.staged ?? [])]) {
      add(entry.path, entry.status);
    }
    for (const entry of state?.untracked ?? []) add(entry.path, '?');
    return { project, root, statusByPath, dirtyFolders, selectedPath };
  }, [project, root, state, selectedPath]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-1" role="tree" aria-label="Project files">
      <Directory context={context} path={root} depth={0} />
    </div>
  );
}
