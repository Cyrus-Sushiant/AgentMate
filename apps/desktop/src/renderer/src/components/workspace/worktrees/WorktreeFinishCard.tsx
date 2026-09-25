import { type Project, parseScopeId, type WorktreeInfo } from '@agentmat/core';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, GitBranch, GitMerge, GitPullRequest, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useWorktrees } from '@/hooks/useWorktrees';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { worktreeLabel } from '@/lib/workspace/scope';
import { useWorktreeCommands } from './useWorktreeCommands';

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Where a worktree's branch stands against its base, in one line. */
function standing(worktree: WorktreeInfo, base: string): { text: string; done: boolean } {
  const status = worktree.status;
  if (!status) return { text: 'Status unknown', done: false };
  const done = status.merged && status.ahead === 0 && status.changes === 0;
  if (done) return { text: `Everything here is in ${base}`, done };
  const commits =
    status.ahead > 0 && status.behind > 0
      ? `${plural(status.ahead, 'commit')} ahead, ${status.behind} behind ${base}`
      : status.ahead > 0
        ? `${plural(status.ahead, 'commit')} ahead of ${base}`
        : status.behind > 0
          ? `${status.behind} behind ${base}`
          : `Nothing new since ${base}`;
  const text =
    status.changes > 0 ? `${plural(status.changes, 'uncommitted change')} · ${commits}` : commits;
  return { text, done };
}

/**
 * The top of a worktree's Source control tab: where its branch stands and the ways to finish it.
 * Once everything is merged, removing the worktree becomes the suggested next step.
 */
export function WorktreeFinishCard({
  project,
  worktree,
}: {
  /** The project itself (its main checkout), not the worktree's workspace. */
  project: Project;
  worktree: WorktreeInfo;
}): React.JSX.Element {
  const commands = useWorktreeCommands();
  const base = worktree.baseBranch ?? 'its base';
  const { text, done } = standing(worktree, base);
  const canMerge =
    Boolean(worktree.branch) && !worktree.missing && (worktree.status?.ahead ?? 0) > 0;

  return (
    <div
      className={cn(
        'mx-2.5 mt-2.5 rounded-lg border px-3 py-2.5',
        done ? 'border-success/30 bg-success/[0.07]' : 'border-primary/25 bg-primary/[0.05]',
      )}
    >
      <div className="flex items-center gap-1.5 text-xs">
        <GitBranch className="h-3 w-3 shrink-0 text-primary" />
        <span className="truncate font-mono font-semibold">{worktreeLabel(worktree)}</span>
        <span className="shrink-0 text-muted-foreground">→ {base}</span>
      </div>
      <p
        className={cn(
          'mt-1 flex items-center gap-1.5 text-[11px]',
          done ? 'text-success' : 'text-muted-foreground',
        )}
      >
        {done ? <CircleCheck className="h-3 w-3" /> : null}
        {text}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={done ? 'outline' : 'default'}
          className="h-7 gap-1.5 px-2.5 text-[11px]"
          disabled={!canMerge}
          onClick={() => commands.merge(project, worktree)}
        >
          <GitMerge className="h-3 w-3" />
          Merge into {base}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 px-2.5 text-[11px]"
          disabled={!worktree.branch}
          onClick={() => commands.pullRequest(project, worktree)}
        >
          <GitPullRequest className="h-3 w-3" />
          Create pull request
        </Button>
        <Button
          size="sm"
          variant={done ? 'default' : 'ghost'}
          className="h-7 gap-1.5 px-2.5 text-[11px]"
          onClick={() => commands.remove(project, worktree)}
        >
          <Trash2 className="h-3 w-3" />
          Remove worktree
        </Button>
      </div>
    </div>
  );
}

/** The finish card when the panel belongs to a worktree's workspace, and nothing otherwise. */
export function WorktreeFinishSlot({ project }: { project: Project }): React.JSX.Element | null {
  const { projectId, worktreeId } = parseScopeId(project.id);
  const worktrees = useWorktrees(worktreeId ? projectId : null).data;
  const projects = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  }).data;
  const parent = projects?.find((p) => p.id === projectId);
  const worktree = worktrees?.find((w) => w.id === worktreeId);
  if (!worktreeId || !parent || !worktree) return null;
  return <WorktreeFinishCard project={parent} worktree={worktree} />;
}
