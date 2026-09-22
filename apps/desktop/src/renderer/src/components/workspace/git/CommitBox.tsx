import type { WorkspaceGitState } from '@shared/apiTypes';
import { useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { create } from 'zustand';
import { Check, ChevronDown, CloudUpload, Plus, Sparkles, Spinner } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { sanitizeCommitMessage } from '@/lib/git';
import { cn } from '@/lib/utils';
import { commandForEvent, useShortcutLabel, useShortcutStore } from '@/stores/shortcutStore';
import type { GitActions } from './useWorkspaceGit';

/**
 * Half-written commit messages and in-flight AI requests, kept per project while the app
 * runs. Living outside the component means switching panel tabs or navigating away and
 * back doesn't lose track of a generation request that's still running.
 */
const useCommitDrafts = create<{
  drafts: Record<string, string>;
  generating: Record<string, string | null>;
}>(() => ({ drafts: {}, generating: {} }));

/** A two-line commit option: what it does on top, what it will touch underneath. */
function CommitMenuItem({
  icon,
  title,
  description,
  shortcut,
  disabled,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  shortcut: string | null;
  disabled?: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={onSelect}
      className="group items-start gap-2.5 px-2 py-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-foreground/[0.04] text-muted-foreground transition-colors group-focus:border-primary/30 group-focus:bg-primary/15 group-focus:text-primary">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Wraps the shortcut under the title rather than cutting the title off. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="whitespace-nowrap text-[13px] font-medium leading-5">{title}</span>
          {shortcut ? (
            <kbd className="ml-auto shrink-0 rounded border border-border/80 bg-foreground/[0.04] px-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
              {shortcut}
            </kbd>
          ) : null}
        </span>
        <span className="text-[11px] leading-snug text-muted-foreground">{description}</span>
      </span>
    </DropdownMenuItem>
  );
}

const MAX_ROWS = 8;
const LINE_HEIGHT = 20;
/** Vertical padding (py-2) plus the 1px border on each side. */
const CHROME_HEIGHT = 16 + 2;

/** Sizes the textarea to its text, between one and MAX_ROWS lines. */
function fitTextarea(el: HTMLTextAreaElement): void {
  // A hidden textarea (the panel is on another tab) measures as zero. Leave the height
  // alone and let the resize observer fit it once it's shown.
  if (el.offsetParent === null) return;
  el.style.height = 'auto';
  const max = MAX_ROWS * LINE_HEIGHT + CHROME_HEIGHT;
  // scrollHeight leaves out the border, but the height is set on the border box.
  const needed = el.scrollHeight + (el.offsetHeight - el.clientHeight);
  el.style.height = `${Math.min(needed, max)}px`;
  el.style.overflowY = needed > max ? 'auto' : 'hidden';
}

export interface CommitBoxProps {
  projectId: string;
  state: WorkspaceGitState;
  actions: GitActions;
}

export function CommitBox({ projectId, state, actions }: CommitBoxProps): React.JSX.Element {
  const message = useCommitDrafts((s) => s.drafts[projectId] ?? '');
  const setMessage = (value: string): void =>
    useCommitDrafts.setState((s) => ({ drafts: { ...s.drafts, [projectId]: value } }));
  const [busy, setBusy] = useState<'commit' | 'push' | null>(null);
  const generating = useCommitDrafts((s) => s.generating[projectId] ?? null);
  const setGenerating = (value: string | null): void =>
    useCommitDrafts.setState((s) => ({ generating: { ...s.generating, [projectId]: value } }));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stagedCount = state.staged.length;
  const pendingCount = state.unstaged.length + state.untracked.length;
  const stageAllFirst = stagedCount === 0 && pendingCount > 0;
  const nothingToCommit = stagedCount === 0 && pendingCount === 0;
  const blockedByConflicts = state.conflicts.length > 0;
  const canCommit =
    message.trim().length > 0 && !nothingToCommit && !blockedByConflicts && busy === null;
  const canPush = state.hasRemote && !state.detached && state.branch !== null;

  const commitLabel = useShortcutLabel('commit.commit');
  const pushLabel = useShortcutLabel('commit.commitAndPush');

  // Grow with the message, one to eight lines. Only a longer message scrolls, and even then
  // without a visible scrollbar squeezing the text.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the height follows the text
  useLayoutEffect(() => {
    if (textareaRef.current) fitTextarea(textareaRef.current);
  }, [message]);

  // An AI message can land while the panel is hidden, where the textarea measures as zero
  // tall, and a narrower panel re-wraps the text. Measure again whenever the width changes
  // (including going from hidden to shown). Height changes are ignored so fitting doesn't
  // trigger itself.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    let lastWidth = -1;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      if (width === lastWidth) return;
      lastWidth = width;
      fitTextarea(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  async function commit(push: boolean): Promise<void> {
    // Pushing without a remote or branch would leave a commit behind and then fail.
    if (!canCommit || (push && !canPush)) return;
    setBusy(push ? 'push' : 'commit');
    try {
      if (stageAllFirst) {
        await actions.stage([...state.unstaged, ...state.untracked].map((entry) => entry.path));
      }
      const ok = await actions.commit(message, push);
      if (ok) setMessage('');
    } finally {
      setBusy(null);
    }
  }

  async function generate(): Promise<void> {
    if (generating) {
      void window.agentmat.git.cancelSuggestCommitMessage(generating);
      setGenerating(null);
      return;
    }
    const requestId = crypto.randomUUID();
    setGenerating(requestId);
    try {
      const result = await window.agentmat.git.suggestCommitMessage(
        projectId,
        requestId,
        stagedCount > 0 ? 'staged' : 'all',
      );
      if (result.cancelled) return;
      if (result.ok && result.text) {
        setMessage(sanitizeCommitMessage(result.text));
        textareaRef.current?.focus();
      } else {
        toast.error('Could not write a commit message', { description: result.error });
      }
    } finally {
      // Only clears the flag if this is still the request that set it: a cancel followed
      // by a fresh generate() shouldn't have the stale request's finally block wipe it out.
      useCommitDrafts.setState((s) =>
        s.generating[projectId] === requestId
          ? { generating: { ...s.generating, [projectId]: null } }
          : s,
      );
    }
  }

  const primaryLabel = stageAllFirst ? 'Stage all & commit' : 'Commit';

  const changesLabel = `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'}`;
  const stagedLabel = `${stagedCount} staged ${stagedCount === 1 ? 'file' : 'files'}`;
  const pushTarget = state.upstream ? `push to ${state.upstream}` : `publish ${state.branch}`;
  const pushDescription = !state.hasRemote
    ? 'Add a remote to push this repository'
    : !canPush
      ? 'Check out a branch to push'
      : stageAllFirst
        ? `Stage all ${changesLabel}, commit, then ${pushTarget}`
        : `Commit ${stagedLabel}, then ${pushTarget}`;

  return (
    <div className="space-y-2 border-b border-border/60 px-2.5 pb-3 pt-2.5">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={message}
          rows={1}
          spellCheck
          disabled={busy !== null}
          aria-label="Commit message"
          placeholder={commitLabel ? `Message (${commitLabel} to commit)` : 'Commit message'}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            const id = commandForEvent(
              event.nativeEvent,
              useShortcutStore.getState().overrides,
              true,
              'commit',
            );
            if (!id) return;
            // Stops the Workspace shortcuts from also acting on the same keys.
            event.preventDefault();
            void commit(id === 'commit.commitAndPush');
          }}
          style={{ lineHeight: `${LINE_HEIGHT}px`, minHeight: LINE_HEIGHT + CHROME_HEIGHT }}
          className={cn(
            'block w-full resize-none overflow-hidden rounded-lg border border-input bg-background/60 py-2 pl-2.5 pr-9 text-[13px] outline-none transition-colors [scrollbar-width:none] placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:opacity-60 [&::-webkit-scrollbar]:hidden',
            generating && 'shimmer',
          )}
        />
        <SimpleTooltip label={generating ? 'Stop writing' : 'Write a message with AI'}>
          <button
            type="button"
            aria-label={
              generating ? 'Stop writing the commit message' : 'Write a commit message with AI'
            }
            onClick={() => void generate()}
            disabled={nothingToCommit && !generating}
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
          >
            {generating ? (
              <Spinner className="h-3.5 w-3.5 animate-spin text-primary motion-reduce:animate-none" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </button>
        </SimpleTooltip>
      </div>

      <div className="flex">
        <button
          type="button"
          onClick={() => void commit(false)}
          disabled={!canCommit}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-l-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-[0_0_18px_-8px_hsl(var(--primary)/0.8)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-foreground/[0.08] disabled:text-muted-foreground disabled:shadow-none"
        >
          {busy === 'commit' ? (
            <Spinner className="h-3 w-3 animate-spin motion-reduce:animate-none" />
          ) : stageAllFirst ? (
            <Plus className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          {primaryLabel}
          {stagedCount > 0 ? (
            <span className="rounded-full bg-primary-foreground/15 px-1.5 text-[10px] tabular-nums">
              {stagedCount}
            </span>
          ) : null}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More commit options"
              disabled={!canCommit}
              className="inline-flex h-8 w-8 items-center justify-center rounded-r-lg border-l border-primary-foreground/20 bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:border-border disabled:bg-foreground/[0.08] disabled:text-muted-foreground"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" collisionPadding={8} className="w-[19rem] p-1">
            <CommitMenuItem
              icon={<Check className="h-3.5 w-3.5" />}
              title="Commit"
              description={
                stageAllFirst
                  ? `Stage all ${changesLabel}, then commit locally`
                  : `Commit ${stagedLabel} locally`
              }
              shortcut={commitLabel}
              onSelect={() => void commit(false)}
            />
            <CommitMenuItem
              icon={<CloudUpload className="h-3.5 w-3.5" />}
              title="Commit & push"
              description={pushDescription}
              shortcut={pushLabel}
              disabled={!canPush}
              onSelect={() => void commit(true)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {blockedByConflicts ? (
        <p className="text-[11px] leading-snug text-destructive">
          Resolve the conflicts below before committing.
        </p>
      ) : null}
      {busy === 'push' ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Spinner className="h-2.5 w-2.5 animate-spin motion-reduce:animate-none" /> Committing and
          pushing…
        </p>
      ) : null}
    </div>
  );
}
