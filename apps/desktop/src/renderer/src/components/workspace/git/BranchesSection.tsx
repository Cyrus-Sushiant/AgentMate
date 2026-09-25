import { type Project, parseScopeId, type WorktreeInfo } from '@agentmat/core';
import type { GitBranchInfo, WorkspaceGitState } from '@shared/apiTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Check,
  CloudDownload,
  FolderPlus,
  GitBranch,
  Search,
  Spinner,
  Trash2,
} from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useWorktrees } from '@/hooks/useWorktrees';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/stores/confirmStore';
import { useWorktreeCommands } from '../worktrees/useWorktreeCommands';

/** Paths from git and from the project list can differ in slashes and, on Windows, case. */
function samePath(a: string, b: string): boolean {
  const norm = (p: string): string =>
    p
      .replace(/[\\/]+$/, '')
      .replaceAll('\\', '/')
      .toLowerCase();
  return norm(a) === norm(b);
}

/** Who else has a branch checked out: the main checkout, or one of the project's worktrees. */
type Holder = { kind: 'main' } | { kind: 'worktree'; worktree: WorktreeInfo | null };

/**
 * Local and remote branches, with the current one marked. Clicking a branch switches to it;
 * git refuses (and the reason is shown) when uncommitted changes would be overwritten. A branch
 * that another worktree (or the main checkout) has checked out opens that workspace instead,
 * since git checks a branch out in one place at a time.
 * Local branches delete locally; a branch that only exists on the remote is deleted there.
 * The default branch and master can't be deleted from here.
 */
export function BranchesSection({
  project,
  state,
  creating,
  onCreatingChange,
}: {
  project: Project;
  state: WorkspaceGitState | undefined;
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const { projectId: parentId } = parseScopeId(project.id);
  const worktreeCommands = useWorktreeCommands();
  const worktrees = useWorktrees(parentId).data;
  const projects = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  }).data;
  const parent = projects?.find((p) => p.id === parentId) ?? null;
  const status = useQuery({
    // Keyed on the branch so a switch made anywhere re-reads the list.
    queryKey: [...queryKeys.gitStatus(project.id), state?.branch ?? '', state?.head ?? ''],
    queryFn: () => window.agentmat.git.status(project.id),
    enabled: Boolean(state?.isRepo),
    meta: { silentLoading: true },
    placeholderData: (previous) => previous,
  });

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(project.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.gitWorkspaceState(project.id) });
  };

  function holderOf(branch: GitBranchInfo): Holder | null {
    const path = branch.worktreePath;
    if (!path) return null;
    if (parent && samePath(path, parent.folderPath)) return { kind: 'main' };
    return { kind: 'worktree', worktree: worktrees?.find((w) => samePath(w.path, path)) ?? null };
  }

  async function switchTo(branch: GitBranchInfo): Promise<void> {
    if (busy || branch.name === state?.branch) return;
    const holder = holderOf(branch);
    if (holder?.kind === 'main') {
      worktreeCommands.openMain(parentId);
      return;
    }
    if (holder?.kind === 'worktree') {
      if (holder.worktree && parent) worktreeCommands.open(parent, holder.worktree);
      else
        toast.info(`${branch.name} is open in another worktree`, {
          description: branch.worktreePath,
        });
      return;
    }
    const dirty = state
      ? state.staged.length + state.unstaged.length + state.conflicts.length > 0
      : false;
    if (dirty) {
      const ok = await confirmDialog({
        title: `Switch to ${branch.name}?`,
        description:
          'You have uncommitted changes. Git carries them over when it can, and refuses when they would be overwritten.',
        confirmLabel: 'Switch branch',
      });
      if (!ok) return;
    }
    setBusy(branch.name);
    const result = await window.agentmat.git.checkoutBranch(project.id, branch.name);
    setBusy(null);
    if (result.ok) toast.success(`Switched to ${branch.name}`);
    else toast.error(`Could not switch to ${branch.name}`, { description: result.message });
    refresh();
  }

  async function remove(branch: GitBranchInfo): Promise<void> {
    const onRemote = !branch.local;
    const ok = await confirmDialog({
      title: onRemote ? `Delete ${branch.name} on the remote?` : `Delete ${branch.name}?`,
      description: onRemote
        ? 'The branch is removed from the remote for everyone. Commits only on it can be lost.'
        : 'The local branch is deleted. Commits only on it can be lost.',
      confirmLabel: onRemote ? 'Delete remote branch' : 'Delete branch',
      variant: 'destructive',
    });
    if (!ok) return;
    setBusy(branch.name);
    const result = await window.agentmat.git.deleteBranch({
      projectId: project.id,
      branchName: branch.name,
    });
    setBusy(null);
    if (result.ok)
      toast.success(onRemote ? `Deleted ${branch.name} on the remote` : `Deleted ${branch.name}`);
    else toast.error(`Could not delete ${branch.name}`, { description: result.message });
    refresh();
  }

  async function create(): Promise<void> {
    const name = newName.trim();
    if (!name) {
      onCreatingChange(false);
      return;
    }
    setBusy(name);
    const result = await window.agentmat.git.createBranch(project.id, name);
    setBusy(null);
    if (result.ok) {
      toast.success(`Created and switched to ${name}`);
      setNewName('');
      onCreatingChange(false);
    } else {
      toast.error('Could not create the branch', { description: result.message });
    }
    refresh();
  }

  if (!state?.isRepo) {
    return <p className="p-3 text-xs text-muted-foreground">Not a git repository.</p>;
  }
  if (status.isPending) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-4 rounded" style={{ width: `${70 - i * 10}%` }} />
        ))}
      </div>
    );
  }

  const all = status.data?.branches ?? [];
  const query = filter.trim().toLowerCase();
  const visible = query ? all.filter((b) => b.name.toLowerCase().includes(query)) : all;
  const local = visible.filter((b) => b.local);
  const remoteOnly = visible.filter((b) => !b.local && b.remote);
  const defaultBranch = status.data?.defaultBranch ?? null;

  const row = (branch: GitBranchInfo): React.JSX.Element => {
    const current = branch.name === state.branch;
    const holder = current ? null : holderOf(branch);
    return (
      <div
        key={`${branch.local ? 'l' : 'r'}:${branch.name}`}
        className={cn(
          'group/branch mx-1 flex h-7 items-center gap-2 rounded-md pl-2 pr-1 text-[12px] transition-colors',
          current ? 'bg-primary/10 text-foreground' : 'hover:bg-foreground/[0.05]',
        )}
      >
        <button
          type="button"
          onClick={() => void switchTo(branch)}
          disabled={current || busy !== null}
          className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
        >
          {busy === branch.name ? (
            <Spinner className="h-3 w-3 shrink-0 animate-spin text-primary" />
          ) : current ? (
            <Check className="h-3 w-3 shrink-0 text-primary" />
          ) : branch.local ? (
            <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <CloudDownload className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <span className={cn('truncate font-mono', current && 'font-semibold')}>
            {branch.name}
          </span>
          {branch.name === defaultBranch ? (
            <span className="shrink-0 rounded bg-foreground/[0.07] px-1 text-[9px] uppercase text-muted-foreground">
              default
            </span>
          ) : null}
          {branch.local && !branch.remote && state.hasRemote && !holder ? (
            <span className="shrink-0 text-[10px] text-muted-foreground/70">local only</span>
          ) : null}
          {holder ? (
            <span className="ml-auto flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1 text-[9px] font-medium text-primary">
              <GitBranch className="h-2 w-2" />
              {holder.kind === 'main' ? 'in main checkout' : 'in worktree'}
            </span>
          ) : null}
        </button>
        {!current && !holder ? (
          <SimpleTooltip label="Open in a new worktree">
            <button
              type="button"
              aria-label={`Open ${branch.name} in a new worktree`}
              onClick={() =>
                worktreeCommands.create({
                  projectId: parentId,
                  branch: branch.name,
                  mode: 'existing',
                })
              }
              disabled={busy !== null}
              className="hidden h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-primary group-hover/branch:flex focus-visible:flex"
            >
              <FolderPlus className="h-2.5 w-2.5" />
            </button>
          </SimpleTooltip>
        ) : null}
        {!current && !holder && branch.name !== defaultBranch && branch.name !== 'master' ? (
          <SimpleTooltip label={branch.local ? 'Delete branch' : 'Delete remote branch'}>
            <button
              type="button"
              aria-label={`Delete ${branch.name}`}
              onClick={() => void remove(branch)}
              disabled={busy !== null}
              className="hidden h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-destructive group-hover/branch:flex"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </SimpleTooltip>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {creating ? (
        <form
          className="flex items-center gap-1.5 px-2.5 pb-1 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <GitBranch className="h-3 w-3 shrink-0 text-primary" />
          <input
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value.replace(/\s+/g, '-'))}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onCreatingChange(false);
            }}
            onBlur={() => {
              if (!newName.trim()) onCreatingChange(false);
            }}
            placeholder="new-branch-name, then Enter"
            aria-label="New branch name"
            className="h-7 min-w-0 flex-1 rounded-md border border-primary/40 bg-background/60 px-2 font-mono text-[12px] outline-none focus:ring-2 focus:ring-primary/20"
          />
        </form>
      ) : null}
      {all.length > 8 ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Search className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter branches"
            aria-label="Filter branches"
            className="h-6 min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {local.map(row)}
        {remoteOnly.length > 0 ? (
          <>
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
              Remote
            </p>
            {remoteOnly.map(row)}
          </>
        ) : null}
        {visible.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No branch matches.</p>
        ) : null}
      </div>
    </div>
  );
}
