import type { Project } from '@agentmat/core';
import type { PullRequestStatus } from '@shared/apiTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { GitPullRequest, Sparkles, Spinner, TriangleAlert } from '@/components/icons';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { PR_GHOST_BUTTON, useRevealInPanel } from './PrCard';

const FIELD =
  'block w-full rounded-lg border border-input bg-background/60 px-2.5 py-1.5 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:opacity-60';

/** Opens a PR for the current branch; pushes it first, and can have the CLI write the text. */
export function CreatePrForm({
  project,
  status,
  roomy = false,
}: {
  project: Project;
  status: PullRequestStatus;
  /** Larger fields for the large PR view, where there's space to write a real description. */
  roomy?: boolean;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const revealPanelSection = useRevealInPanel();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [base, setBase] = useState(status.defaultBranch ?? 'main');
  const [draft, setDraft] = useState(false);
  const [creating, setCreating] = useState(false);
  const [writing, setWriting] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const branches = useQuery({
    queryKey: queryKeys.gitStatus(project.id),
    queryFn: () => window.agentmat.git.status(project.id),
    meta: { silentLoading: true },
  });
  const baseOptions = (branches.data?.branches ?? [])
    .map((branch) => branch.name)
    .filter((name) => name !== status.branch)
    .map((name) => ({ value: name, label: name }));

  async function write(): Promise<void> {
    if (writing) {
      void window.agentmat.pullRequests.cancelAi(writing);
      setWriting(null);
      return;
    }
    const requestId = crypto.randomUUID();
    setWriting(requestId);
    try {
      const result = await window.agentmat.pullRequests.suggestText(project.id, requestId, base);
      if (result.cancelled) return;
      if (result.ok) {
        if (result.title) setTitle(result.title);
        if (result.body) setBody(result.body);
        titleRef.current?.focus();
      } else {
        toast.error('Could not write the pull request', { description: result.error });
      }
    } finally {
      setWriting((current) => (current === requestId ? null : current));
    }
  }

  async function create(): Promise<void> {
    setCreating(true);
    try {
      const result = await window.agentmat.git.createPullRequest({
        projectId: project.id,
        title: title.trim(),
        body,
        base,
        draft,
      });
      if (!result.ok) {
        toast.error('Could not create the pull request', { description: result.error });
        return;
      }
      if (result.usedFallback && result.url) {
        void window.agentmat.shell.openExternal(result.url);
        toast.success('Opened the pull request page on GitHub', {
          description: 'Install the GitHub CLI to create pull requests from here.',
        });
      } else {
        const url = result.url;
        toast.success(draft ? 'Draft pull request created' : 'Pull request created', {
          action: url
            ? {
                label: 'Open on GitHub',
                onClick: () => void window.agentmat.shell.openExternal(url),
              }
            : undefined,
        });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.pullRequest(project.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitWorkspaceState(project.id) });
    } finally {
      setCreating(false);
    }
  }

  const pushNote = !status.hasUpstream
    ? 'The branch will be published to GitHub first.'
    : status.ahead > 0
      ? `${status.ahead} ${status.ahead === 1 ? 'commit' : 'commits'} will be pushed first.`
      : null;

  return (
    <section
      aria-label="New pull request"
      className={cn(
        'space-y-2.5 rounded-lg border border-border/70 bg-card/40',
        roomy ? 'p-4' : 'mx-2 p-3',
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <GitPullRequest className="h-3 w-3 shrink-0" />
        <span className="truncate font-mono text-foreground/85">{status.branch}</span>
        <span aria-hidden="true">→</span>
        {baseOptions.length > 0 ? (
          <Combobox
            options={baseOptions}
            value={base}
            onChange={setBase}
            placeholder={status.defaultBranch ?? 'main'}
            searchPlaceholder="Search branches…"
            emptyText="No branches found."
            className="h-6 min-w-0 flex-1 font-mono text-[11px]"
          />
        ) : (
          <span className="truncate font-mono text-foreground/85">{base}</span>
        )}
      </div>

      {status.dirty ? (
        <div className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/[0.06] px-2 py-1.5 text-[11px] leading-snug">
          <TriangleAlert className="mt-0.5 h-2.5 w-2.5 shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            You have uncommitted changes. They are not part of the pull request until you commit
            them.
          </span>
          <button
            type="button"
            onClick={() => revealPanelSection('changes')}
            className={cn(PR_GHOST_BUTTON, 'h-5 shrink-0 px-1.5')}
          >
            Review changes
          </button>
        </div>
      ) : null}

      <div className="relative">
        <input
          ref={titleRef}
          value={title}
          aria-label="Pull request title"
          placeholder="Title"
          disabled={creating}
          onChange={(event) => setTitle(event.target.value)}
          className={cn(FIELD, 'pr-9', roomy && 'py-2 text-sm font-medium', writing && 'shimmer')}
        />
        <SimpleTooltip label={writing ? 'Stop writing' : 'Write the title and description with AI'}>
          <button
            type="button"
            aria-label={writing ? 'Stop writing' : 'Write the title and description with AI'}
            onClick={() => void write()}
            disabled={creating}
            className={cn(
              'absolute right-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40',
              roomy ? 'top-1.5' : 'top-1',
            )}
          >
            {writing ? (
              <Spinner className="h-3.5 w-3.5 animate-spin text-primary motion-reduce:animate-none" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </button>
        </SimpleTooltip>
      </div>

      <textarea
        value={body}
        rows={roomy ? 14 : 5}
        aria-label="Pull request description"
        placeholder="What changed and why (optional)"
        disabled={creating}
        onChange={(event) => setBody(event.target.value)}
        className={cn(FIELD, 'resize-y text-[12px] leading-relaxed', writing && 'shimmer')}
      />

      <label className="flex cursor-pointer items-center gap-2 text-[11.5px]">
        <Checkbox
          checked={draft}
          onCheckedChange={(value) => setDraft(value === true)}
          className="h-4 w-4"
          aria-label="Open as a draft"
        />
        Open as a draft
      </label>

      {pushNote ? <p className="text-[11px] text-muted-foreground">{pushNote}</p> : null}

      <button
        type="button"
        onClick={() => void create()}
        disabled={!title.trim() || creating || writing !== null}
        className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-[0_0_18px_-8px_hsl(var(--primary)/0.8)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-foreground/[0.08] disabled:text-muted-foreground disabled:shadow-none"
      >
        {creating ? (
          <Spinner className="h-3 w-3 animate-spin motion-reduce:animate-none" />
        ) : (
          <GitPullRequest className="h-3 w-3" />
        )}
        {creating ? 'Pushing and creating…' : 'Create pull request'}
      </button>
    </section>
  );
}
