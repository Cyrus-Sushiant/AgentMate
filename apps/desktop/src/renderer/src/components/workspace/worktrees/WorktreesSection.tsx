import { type Project, parseScopeId, type WorktreeInfo } from '@agentmat/core';
import { useQuery } from '@tanstack/react-query';
import { EllipsisVertical, FolderTree, GitBranch, Plus, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useWorktrees } from '@/hooks/useWorktrees';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { worktreeLabel } from '@/lib/workspace/scope';
import { statusSummary } from '@/lib/workspace/worktreeText';
import { useWorktreeCommands, type WorktreeCommands } from './useWorktreeCommands';
import { WorktreeMenuItems } from './WorktreeMenuItems';

const BADGE_TONE = {
  changes: 'bg-warning/15 text-warning',
  ahead: 'bg-primary/12 text-primary',
  behind: 'bg-foreground/[0.07] text-muted-foreground',
} as const;

function PathText({ path }: { path: string }): React.JSX.Element {
  // rtl keeps the end of a long path, the part that tells worktrees apart, in view.
  return (
    <span className="block truncate font-mono text-[10px] text-muted-foreground" dir="rtl">
      <bdi>{path}</bdi>
    </span>
  );
}

function WorktreeRow({
  project,
  worktree,
  current,
  commands,
}: {
  project: Project;
  worktree: WorktreeInfo;
  current: boolean;
  commands: WorktreeCommands;
}): React.JSX.Element {
  const label = worktreeLabel(worktree);
  const badges = worktree.status ? statusSummary(worktree.status) : [];
  return (
    <li
      className={cn(
        'group flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-accent/60',
        current && 'bg-primary/[0.06]',
      )}
    >
      <button
        type="button"
        aria-label={`Open ${label}`}
        disabled={current || worktree.missing}
        onClick={() => commands.open(project, worktree)}
        className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-default"
      >
        <GitBranch
          className={cn(
            'mt-0.5 h-3 w-3 shrink-0',
            current ? 'text-primary' : 'text-muted-foreground',
            worktree.missing && 'text-warning',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                'truncate text-xs',
                worktree.missing && 'text-muted-foreground line-through',
              )}
            >
              {label}
            </span>
            {current ? (
              <span className="shrink-0 rounded-full bg-primary/15 px-1.5 text-[9px] font-semibold leading-4 text-primary">
                This workspace
              </span>
            ) : null}
            {worktree.missing ? (
              <span className="shrink-0 rounded-full bg-warning/15 px-1.5 text-[9px] font-semibold leading-4 text-warning">
                Folder missing
              </span>
            ) : null}
            {worktree.locked ? (
              <SimpleTooltip label={worktree.lockReason ?? 'Locked with git worktree lock'}>
                <span className="shrink-0 rounded-full bg-foreground/[0.07] px-1.5 text-[9px] font-semibold leading-4 text-muted-foreground">
                  Locked
                </span>
              </SimpleTooltip>
            ) : null}
          </span>
          {/* Badges share the second line with the path, so the branch name keeps its room. */}
          <span className="flex min-w-0 items-center gap-1">
            {badges.map((badge) => (
              <span
                key={badge.kind}
                className={cn(
                  'shrink-0 rounded px-1 text-[9px] font-semibold leading-4 tabular-nums',
                  BADGE_TONE[badge.kind],
                )}
              >
                {badge.text}
              </span>
            ))}
            <span className="min-w-0 flex-1">
              <PathText path={worktree.path} />
            </span>
          </span>
          {!worktree.createdByApp ? (
            <span className="block text-[10px] text-muted-foreground/80">
              Added outside AgentMate
            </span>
          ) : null}
        </span>
      </button>
      <DropdownMenu modal={false}>
        <SimpleTooltip label="More actions">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`More actions for ${label}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <EllipsisVertical className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
        </SimpleTooltip>
        <DropdownMenuContent align="end" className="min-w-[13rem]">
          <WorktreeMenuItems
            project={project}
            worktree={worktree}
            commands={commands}
            Item={DropdownMenuItem}
            Separator={DropdownMenuSeparator}
            showOpen={!current}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/**
 * The Worktrees section of Source control: every worktree of the project with where it stands,
 * one click to open its workspace, and the rest behind each row's menu.
 */
export function WorktreesSection({ project }: { project: Project }): React.JSX.Element {
  const { projectId, worktreeId } = parseScopeId(project.id);
  const commands = useWorktreeCommands();
  const query = useWorktrees(projectId);
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.agentmat.projects.list(),
  });
  // Commands need the project itself; inside a worktree `project` is the worktree's view of it.
  const parent =
    projectsQuery.data?.find((p) => p.id === projectId) ?? (worktreeId ? null : project);

  if (query.isPending || !parent) {
    return (
      <div className="space-y-1.5 px-2.5 py-2" aria-label="Loading worktrees">
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 w-4/5 rounded-md" />
      </div>
    );
  }

  const worktrees = query.data ?? [];
  const missing = worktrees.filter((w) => w.missing).length;

  return (
    <div className="px-1.5 pb-2">
      {worktreeId ? (
        <button
          type="button"
          aria-label="Open the main checkout"
          onClick={() => commands.openMain(projectId)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <FolderTree className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block">Main checkout</span>
            <PathText path={parent.folderPath} />
          </span>
        </button>
      ) : null}
      {worktrees.length === 0 ? (
        <div className="px-2 py-3 text-center">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Work on several branches at once. Each worktree gets its own folder, terminals and
            agents, so parallel tasks never touch each other's files.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2.5 h-7 gap-1.5 px-2.5 text-[11px]"
            onClick={() => commands.create({ projectId })}
          >
            <Plus className="h-3 w-3" />
            New worktree
          </Button>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {worktrees.map((worktree) => (
            <WorktreeRow
              key={worktree.id}
              project={parent}
              worktree={worktree}
              current={worktree.id === worktreeId}
              commands={commands}
            />
          ))}
        </ul>
      )}
      {missing > 0 ? (
        <div className="mx-1 mt-2 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
          <TriangleAlert className="h-3 w-3 shrink-0" />
          <span className="flex-1">
            {missing === 1
              ? 'One worktree’s folder is gone.'
              : `${missing} worktree folders are gone.`}
          </span>
          <button
            type="button"
            onClick={() => commands.prune(projectId)}
            className="rounded px-1.5 py-0.5 font-semibold hover:bg-warning/15"
          >
            Clean up
          </button>
        </div>
      ) : null}
    </div>
  );
}
