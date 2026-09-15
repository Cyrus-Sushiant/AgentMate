import type { GitChangeEntry, Project } from '@agentmat/core';
import type { WorkspaceGitState } from '@shared/apiTypes';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  MonacoDiffEditor,
  type MonacoDiffEditorHandle,
} from '@/components/editor/MonacoDiffEditor';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  File,
  Minus,
  Pin,
  Plus,
  SplitView,
  Undo,
} from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { changeStatusMeta, splitGitPath } from '@/lib/git';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { DIFF_CHANGE_EVENT } from '@/lib/workspace/commands';
import { useShortcutLabel } from '@/stores/shortcutStore';
import { useWorkspaceStore, type WorkspaceDiffTab } from '@/stores/workspaceStore';
import { useGitActions } from './useWorkspaceGit';

function ToolbarButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          'flex h-6 min-w-6 items-center justify-center gap-1 rounded-md px-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active && 'bg-foreground/10 text-foreground',
        )}
      >
        {children}
      </button>
    </SimpleTooltip>
  );
}

function entryFor(
  state: WorkspaceGitState | undefined,
  tab: WorkspaceDiffTab,
): GitChangeEntry | null {
  if (!state) return null;
  const list =
    tab.side === 'staged'
      ? state.staged
      : tab.side === 'unstaged'
        ? state.unstaged
        : tab.side === 'untracked'
          ? state.untracked
          : state.conflicts;
  return list.find((entry) => entry.path === tab.path) ?? null;
}

const SIDE_LABEL: Record<WorkspaceDiffTab['side'], string> = {
  staged: 'Staged',
  unstaged: 'Working tree',
  untracked: 'New file',
  conflict: 'Conflict',
};

/** A file's changes, shown in a pane next to the terminals. */
export default function DiffTab({
  project,
  tab,
  focused,
}: {
  project: Project;
  tab: WorkspaceDiffTab;
  /** In the focused pane, so the next and previous change shortcuts drive this diff. */
  focused: boolean;
}): React.JSX.Element {
  const editorRef = useRef<MonacoDiffEditorHandle>(null);
  const nextChangeLabel = useShortcutLabel('workspace.nextChange');
  const prevChangeLabel = useShortcutLabel('workspace.prevChange');

  useEffect(() => {
    if (!focused) return;
    const onChange = (event: Event): void => {
      const direction = (event as CustomEvent<'next' | 'previous'>).detail;
      editorRef.current?.goToChange(direction);
    };
    window.addEventListener(DIFF_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(DIFF_CHANGE_EVENT, onChange);
  }, [focused]);
  const sideBySide = useWorkspaceStore((s) => s.gitPanel.diffSideBySide);
  const ignoreWhitespace = useWorkspaceStore((s) => s.gitPanel.diffIgnoreWhitespace);
  const setGitPanel = useWorkspaceStore((s) => s.setGitPanel);
  const openDiff = useWorkspaceStore((s) => s.openDiff);
  const actions = useGitActions(project.id);
  const { data: state } = useQuery<WorkspaceGitState>({
    queryKey: queryKeys.gitWorkspaceState(project.id),
    queryFn: () => window.agentmat.git.workspaceState(project.id),
    staleTime: Number.POSITIVE_INFINITY,
    meta: { silentLoading: true },
  });
  const diff = useQuery({
    // A past commit's diff never changes; a working tree diff follows the live state.
    queryKey: tab.commit
      ? queryKeys.gitFileDiff(project.id, `commit:${tab.commit}`, tab.path)
      : queryKeys.gitFileDiff(project.id, tab.side, tab.path),
    queryFn: () =>
      tab.commit
        ? window.agentmat.git.commitFileDiff(project.id, tab.commit, tab.path, tab.origPath)
        : window.agentmat.git.fileDiff(project.id, tab.path, tab.side, tab.origPath),
    staleTime: tab.commit ? Number.POSITIVE_INFINITY : undefined,
    meta: { silentLoading: true },
    // While a refreshed diff loads, keep showing the old one, but never another file's.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === tab.path ? previous : undefined,
  });

  // A commit's file has nothing to stage or discard, so it gets no working tree entry.
  const entry = tab.commit ? null : entryFor(state, tab);
  const stagedToo = state?.staged.some((e) => e.path === tab.path) ?? false;
  const unstagedToo = state?.unstaged.some((e) => e.path === tab.path) ?? false;
  const { dir, name } = splitGitPath(tab.path);
  const meta = entry ? changeStatusMeta(entry.status) : null;
  const gone = !tab.commit && state !== undefined && entry === null;

  return (
    // A container, so the toolbar can drop its extras when the pane is narrow.
    <div className="@container flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <File className="h-3 w-3 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="min-w-[3rem] shrink truncate text-xs font-medium">{name}</span>
          {dir ? (
            <span className="hidden min-w-0 truncate text-[11px] text-muted-foreground [direction:rtl] @2xl:inline">
              <bdi>{dir.replace(/\/$/, '')}</bdi>
            </span>
          ) : null}
          <span className="hidden shrink-0 rounded bg-foreground/[0.06] px-1.5 text-[10px] text-muted-foreground @lg:inline">
            {tab.commit ? `Commit ${tab.commit.slice(0, 7)}` : SIDE_LABEL[tab.side]}
          </span>
          {meta ? (
            <span className={cn('shrink-0 font-mono text-[11px] font-semibold', meta.className)}>
              {meta.letter}
            </span>
          ) : null}
          {entry && !entry.binary && (entry.additions || entry.deletions) ? (
            <span className="hidden shrink-0 font-mono text-[10px] tabular-nums @md:inline">
              <span className="text-success">+{entry.additions ?? 0}</span>{' '}
              <span className="text-destructive">−{entry.deletions ?? 0}</span>
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <ToolbarButton
            label={prevChangeLabel ? `Previous change (${prevChangeLabel})` : 'Previous change'}
            onClick={() => editorRef.current?.goToChange('previous')}
          >
            <ArrowUp className="h-2.5 w-2.5" />
          </ToolbarButton>
          <ToolbarButton
            label={nextChangeLabel ? `Next change (${nextChangeLabel})` : 'Next change'}
            onClick={() => editorRef.current?.goToChange('next')}
          >
            <ArrowDown className="h-2.5 w-2.5" />
          </ToolbarButton>
          <span className="hidden items-center gap-0.5 @lg:flex">
            <span className="mx-1 h-4 w-px bg-border" />
            <ToolbarButton
              label={sideBySide ? 'Show inline' : 'Show side by side'}
              active={sideBySide}
              onClick={() => setGitPanel({ diffSideBySide: !sideBySide })}
            >
              <SplitView className="h-3 w-3" />
            </ToolbarButton>
            <ToolbarButton
              label={ignoreWhitespace ? 'Show whitespace changes' : 'Hide whitespace changes'}
              active={ignoreWhitespace}
              onClick={() => setGitPanel({ diffIgnoreWhitespace: !ignoreWhitespace })}
            >
              <span className="font-mono text-[10px] font-semibold">¶</span>
            </ToolbarButton>
            {tab.preview ? (
              <ToolbarButton
                label="Keep this tab open"
                onClick={() => openDiff(project.id, tab, { pin: true })}
              >
                <Pin className="h-2.5 w-2.5" />
              </ToolbarButton>
            ) : null}
            {entry && tab.side !== 'staged' && entry.status !== 'D' ? (
              <ToolbarButton
                label="Open file"
                onClick={() =>
                  void window.agentmat.shell.openPath(
                    `${project.folderPath.replace(/[\\/]$/, '')}/${tab.path}`,
                  )
                }
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </ToolbarButton>
            ) : null}
          </span>
          {entry && (tab.side === 'unstaged' || tab.side === 'untracked') ? (
            <>
              <span className="mx-1 h-4 w-px bg-border" />
              <ToolbarButton
                label={tab.side === 'untracked' ? 'Delete file' : 'Discard changes'}
                onClick={() =>
                  void actions.discard([tab.path], tab.side as 'unstaged' | 'untracked')
                }
              >
                <Undo className="h-2.5 w-2.5" />
              </ToolbarButton>
            </>
          ) : null}
          {entry ? (
            tab.side === 'staged' ? (
              <button
                type="button"
                onClick={() => void actions.unstage([tab.path])}
                className="ml-1 inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-medium transition-colors hover:bg-foreground/[0.06]"
              >
                <Minus className="h-2.5 w-2.5" /> Unstage
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void actions.stage([tab.path])}
                className="ml-1 inline-flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-all hover:brightness-110"
              >
                <Plus className="h-2.5 w-2.5" />{' '}
                {tab.side === 'conflict' ? 'Mark resolved' : 'Stage'}
              </button>
            )
          ) : null}
        </div>
      </div>

      {gone ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-foreground/[0.03] px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="flex-1">
            {tab.side === 'staged'
              ? 'Nothing about this file is staged anymore.'
              : 'This file has no unstaged changes anymore.'}
          </span>
          {tab.side !== 'staged' && stagedToo ? (
            <button
              type="button"
              onClick={() => openDiff(project.id, { path: tab.path, side: 'staged' })}
              className="font-medium text-primary hover:underline"
            >
              Show staged
            </button>
          ) : null}
          {tab.side === 'staged' && unstagedToo ? (
            <button
              type="button"
              onClick={() => openDiff(project.id, { path: tab.path, side: 'unstaged' })}
              className="font-medium text-primary hover:underline"
            >
              Show working tree
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {!diff.data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton
                key={i}
                className="h-3.5 rounded"
                style={{ width: `${40 + ((i * 37) % 55)}%` }}
              />
            ))}
          </div>
        ) : diff.data.binary || diff.data.tooLarge ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <File className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">
              {diff.data.binary ? 'Binary file' : 'This file is too large to diff here'}
            </p>
            <p className="text-xs text-muted-foreground">
              Open it in your editor to see what changed.
            </p>
          </div>
        ) : (
          <MonacoDiffEditor
            ref={editorRef}
            path={tab.path}
            original={diff.data.original}
            modified={diff.data.modified}
            sideBySide={sideBySide}
            ignoreWhitespace={ignoreWhitespace}
          />
        )}
      </div>
    </div>
  );
}
