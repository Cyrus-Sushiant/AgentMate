import {
  type MergeBlocker,
  type MergeMethod,
  mergeBlockers,
  type Project,
  type PullRequestInfo,
} from '@agentmat/core';
import type { MergePullRequestResult, PullRequestStatus } from '@shared/apiTypes';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, GitMerge, Spinner, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { MergeSteps } from './MergeSteps';
import { PR_GHOST_BUTTON, PrCard } from './PrCard';
import { usePullRequestActions, useRecentMerges } from './usePullRequest';

const METHODS: { id: MergeMethod; label: string; description: string }[] = [
  {
    id: 'squash',
    label: 'Squash and merge',
    description: 'All commits become one commit on the base branch',
  },
  {
    id: 'merge',
    label: 'Create a merge commit',
    description: 'Keeps every commit and adds a merge commit',
  },
  {
    id: 'rebase',
    label: 'Rebase and merge',
    description: 'Replays each commit on top of the base branch',
  },
];

/** Blockers that GitHub will refuse no matter what; the rest it decides by the repo's rules. */
const HARD: ReadonlySet<MergeBlocker['kind']> = new Set(['not-open', 'draft', 'conflicts']);

function methodSteps(method: MergeMethod, pr: PullRequestInfo): string {
  if (method === 'squash') {
    return `Squash the commits of ${pr.head} into one commit on ${pr.base}, on GitHub.`;
  }
  if (method === 'rebase') return `Rebase the commits of ${pr.head} onto ${pr.base}, on GitHub.`;
  return `Merge ${pr.head} into ${pr.base} with a merge commit, on GitHub.`;
}

/** The last card of the flow: pick a method, see what's in the way, merge, and clean up. */
export function MergeCard({
  project,
  pr,
  status,
}: {
  project: Project;
  pr: PullRequestInfo;
  status: Pick<PullRequestStatus, 'dirty'>;
}): React.JSX.Element {
  const actions = usePullRequestActions(project.id);
  const method = useWorkspaceStore((s) => s.gitPanel.mergeMethods[project.id] ?? 'squash');
  const setMergeMethod = useWorkspaceStore((s) => s.setMergeMethod);
  const revealPanelSection = useWorkspaceStore((s) => s.revealPanelSection);
  const recordMerge = useRecentMerges((s) => s.record);
  const [cleanup, setCleanup] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MergePullRequestResult | null>(null);
  const [markingReady, setMarkingReady] = useState(false);

  const current = METHODS.find((m) => m.id === method) ?? METHODS[0]!;
  const blockers = mergeBlockers(pr);
  const dirtyBlocks = cleanup && status.dirty;
  const hard = blockers.filter((b) => HARD.has(b.kind));
  const soft = blockers.filter((b) => !HARD.has(b.kind));
  const blocked = hard.length > 0 || dirtyBlocks;

  async function merge(): Promise<void> {
    setConfirming(false);
    setRunning(true);
    setResult(null);
    try {
      const outcome = await actions.merge({
        number: pr.number,
        base: pr.base,
        head: pr.head,
        method,
        cleanup,
      });
      setResult(outcome);
      if (outcome.merged) {
        recordMerge(project.id, {
          number: pr.number,
          base: pr.base,
          head: pr.head,
          steps: outcome.steps,
        });
      }
      if (outcome.ok) toast.success(`Merged #${pr.number} into ${pr.base}`);
    } finally {
      setRunning(false);
    }
  }

  async function retryCleanup(): Promise<void> {
    setRunning(true);
    try {
      const outcome = await actions.cleanup(pr.base, pr.head);
      const merged = result?.steps.filter((step) => step.step === 'merge') ?? [];
      const next = { ...outcome, steps: [...merged, ...outcome.steps] };
      setResult(next);
      recordMerge(project.id, {
        number: pr.number,
        base: pr.base,
        head: pr.head,
        steps: next.steps,
      });
      if (outcome.ok) toast.success(`Switched to ${pr.base} and deleted ${pr.head}`);
    } finally {
      setRunning(false);
    }
  }

  async function markReady(): Promise<void> {
    setMarkingReady(true);
    try {
      await actions.markReady(pr.number);
    } finally {
      setMarkingReady(false);
    }
  }

  return (
    <PrCard title="Merge" icon={GitMerge} tone={blocked ? 'default' : 'success'}>
      <div className="space-y-2.5 px-3">
        {hard.length > 0 || dirtyBlocks || soft.length > 0 ? (
          <ul className="space-y-1">
            {hard.map((blocker) => (
              <li key={blocker.kind} className="flex items-center gap-1.5 text-[11.5px]">
                <TriangleAlert className="h-2.5 w-2.5 shrink-0 text-destructive" />
                <span className="min-w-0 flex-1">{blocker.message}</span>
                {blocker.kind === 'draft' ? (
                  <button
                    type="button"
                    onClick={() => void markReady()}
                    disabled={markingReady}
                    className={PR_GHOST_BUTTON}
                  >
                    {markingReady ? (
                      <Spinner className="h-2.5 w-2.5 animate-spin motion-reduce:animate-none" />
                    ) : null}
                    Mark ready
                  </button>
                ) : null}
              </li>
            ))}
            {dirtyBlocks ? (
              <li className="flex items-center gap-1.5 text-[11.5px]">
                <TriangleAlert className="h-2.5 w-2.5 shrink-0 text-destructive" />
                <span className="min-w-0 flex-1">
                  You have uncommitted changes. Commit or discard them before switching branches.
                </span>
                <button
                  type="button"
                  onClick={() => revealPanelSection('changes')}
                  className={PR_GHOST_BUTTON}
                >
                  Review changes
                </button>
              </li>
            ) : null}
            {soft.map((blocker) => (
              <li
                key={blocker.kind}
                className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground"
              >
                <TriangleAlert className="h-2.5 w-2.5 shrink-0 text-warning" />
                <span className="min-w-0 flex-1">{blocker.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-1.5 text-[11.5px] text-success">
            <Check className="h-2.5 w-2.5" />
            Ready to merge into {pr.base}.
          </p>
        )}

        <label className="flex cursor-pointer items-start gap-2 text-[11.5px] leading-snug">
          <Checkbox
            checked={cleanup}
            onCheckedChange={(value) => setCleanup(value === true)}
            className="mt-px h-4 w-4"
          />
          <span>
            Delete <span className="font-mono">{pr.head}</span> here and on GitHub, then switch to{' '}
            <span className="font-mono">{pr.base}</span>
          </span>
        </label>

        <div className="flex">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={blocked || running}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-l-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-[0_0_18px_-8px_hsl(var(--primary)/0.8)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-foreground/[0.08] disabled:text-muted-foreground disabled:shadow-none"
          >
            {running ? (
              <Spinner className="h-3 w-3 animate-spin motion-reduce:animate-none" />
            ) : (
              <GitMerge className="h-3 w-3" />
            )}
            {current.label}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Choose merge method"
                disabled={running}
                className="inline-flex h-8 w-8 items-center justify-center rounded-r-lg border-l border-primary-foreground/20 bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-foreground/[0.08] disabled:text-muted-foreground"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" collisionPadding={8} className="w-[17rem] p-1">
              {METHODS.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  onSelect={() => setMergeMethod(project.id, option.id)}
                  className="items-start gap-2 px-2 py-1.5"
                >
                  <Check
                    className={cn(
                      'mt-1 h-3 w-3 shrink-0',
                      option.id === method ? 'text-primary' : 'invisible',
                    )}
                  />
                  <span className="flex flex-col">
                    <span className="text-[13px] font-medium">{option.label}</span>
                    <span className="text-[11px] text-muted-foreground">{option.description}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {running && !result ? (
          <MergeSteps
            steps={[]}
            pending={cleanup ? ['merge', 'checkout', 'pull', 'delete'] : ['merge']}
          />
        ) : null}
        {result ? (
          <div
            className={cn(
              'space-y-1.5 rounded-md border px-2.5 py-2',
              result.ok
                ? 'border-success/30 bg-success/[0.05]'
                : 'border-destructive/30 bg-destructive/[0.05]',
            )}
          >
            <MergeSteps steps={result.steps} />
            {result.merged && !result.ok ? (
              <button
                type="button"
                onClick={() => void retryCleanup()}
                disabled={running}
                className={PR_GHOST_BUTTON}
              >
                Retry cleanup
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {current.label} #{pr.number}?
            </DialogTitle>
            <DialogDescription>{pr.title}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-[13px]">
            <li>{methodSteps(method, pr)}</li>
            {cleanup ? (
              <>
                <li>Switch to {pr.base} here and pull the merge.</li>
                <li>Delete {pr.head} here and on GitHub.</li>
              </>
            ) : null}
          </ul>
          {soft.length > 0 ? (
            <div className="space-y-1 rounded-md border border-warning/30 bg-warning/[0.06] px-3 py-2 text-[12px]">
              {soft.map((blocker) => (
                <p key={blocker.kind} className="flex items-center gap-1.5">
                  <TriangleAlert className="h-3 w-3 shrink-0 text-warning" />
                  {blocker.message}
                </p>
              ))}
              <p className="text-muted-foreground">
                GitHub still refuses the merge if the repository requires these.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button onClick={() => void merge()}>
              {soft.length > 0 ? 'Merge anyway' : current.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PrCard>
  );
}
