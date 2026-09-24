import type { Project, PullRequestInfo } from '@agentmat/core';
import type { PullRequestStatus } from '@shared/apiTypes';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CircleCheck, GitBranch, GitMerge, Spinner, X } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '@/stores/terminalStore';
import { PanelNotice } from '../PanelNotice';
import { CreatePrForm } from './CreatePrForm';
import { MergeCard } from './MergeCard';
import { MergeSteps } from './MergeSteps';
import { PR_GHOST_BUTTON } from './PrCard';
import { PrChecks } from './PrChecks';
import { PrHeader, PrOverview } from './PrHeader';
import { PrReview } from './PrReview';
import { type RecentMerge, usePullRequestActions, useRecentMerges } from './usePullRequest';

function LoadingCards(): React.JSX.Element {
  return (
    <div data-testid="pr-loading" className="space-y-2 p-2">
      <div className="space-y-1.5 px-1">
        <Skeleton className="h-4 w-4/5 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** What the last merge from this tab did, kept on screen after it moved us off the branch. */
function RecentMergeCard({
  project,
  merge,
}: {
  project: Project;
  merge: RecentMerge;
}): React.JSX.Element {
  const dismiss = useRecentMerges((s) => s.dismiss);
  const ok = merge.steps.every((step) => step.ok);
  return (
    <section
      aria-label="Last merge"
      className={cn(
        'mx-2 space-y-1.5 rounded-lg border px-3 py-2',
        ok ? 'border-success/35 bg-success/[0.05]' : 'border-warning/40 bg-warning/[0.05]',
      )}
    >
      <div className="flex items-center gap-1.5">
        <GitMerge className={cn('h-3 w-3 shrink-0', ok ? 'text-success' : 'text-warning')} />
        <p className="min-w-0 flex-1 text-[12px] font-semibold">
          Merged #{merge.number} into {merge.base}
        </p>
        <SimpleTooltip label="Dismiss">
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(project.id)}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </SimpleTooltip>
      </div>
      <MergeSteps steps={merge.steps} />
    </section>
  );
}

/** A PR that is already merged or closed while its branch is still checked out. */
function FinishedPr({
  project,
  pr,
  status,
}: {
  project: Project;
  pr: PullRequestInfo;
  status: PullRequestStatus;
}): React.JSX.Element {
  const actions = usePullRequestActions(project.id);
  const record = useRecentMerges((s) => s.record);
  const [cleaning, setCleaning] = useState(false);
  const merged = pr.state === 'MERGED';

  async function cleanup(): Promise<void> {
    setCleaning(true);
    try {
      const result = await actions.cleanup(pr.base, pr.head);
      record(project.id, {
        number: pr.number,
        base: pr.base,
        head: pr.head,
        steps: [
          { step: 'merge', ok: true, message: `Merged #${pr.number} into ${pr.base}.` },
          ...result.steps,
        ],
      });
      if (result.ok) toast.success(`Switched to ${pr.base} and deleted ${pr.head}`);
      else toast.error('Cleanup did not finish', { description: result.steps.at(-1)?.message });
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="space-y-2">
      <section
        aria-label={merged ? 'Merged' : 'Closed'}
        className="mx-2 space-y-2 rounded-lg border border-border/70 bg-card/40 px-3 py-2.5"
      >
        <p className="flex items-center gap-1.5 text-[12px] font-semibold">
          {merged ? (
            <CircleCheck className="h-3 w-3 text-success" />
          ) : (
            <X className="h-3 w-3 text-destructive" />
          )}
          {merged ? `Merged into ${pr.base}` : 'This pull request was closed'}
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {merged
            ? `You are still on ${pr.head}. Switch to ${pr.base}, pull the merge and delete the branch here and on GitHub.`
            : 'Open a new pull request below, or reopen this one on GitHub.'}
        </p>
        {merged ? (
          <button
            type="button"
            onClick={() => void cleanup()}
            disabled={cleaning || status.dirty}
            className={cn(PR_GHOST_BUTTON, 'bg-foreground/[0.06]')}
          >
            {cleaning ? (
              <Spinner className="h-2.5 w-2.5 animate-spin motion-reduce:animate-none" />
            ) : (
              <GitBranch className="h-2.5 w-2.5" />
            )}
            Switch to {pr.base} and delete {pr.head}
          </button>
        ) : null}
        {merged && status.dirty ? (
          <p className="text-[11px] text-warning">Commit or discard your changes first.</p>
        ) : null}
      </section>
      {merged ? null : <CreatePrForm project={project} status={status} />}
    </div>
  );
}

/** A column of PR cards in the large view; the cards drop their panel margin here. */
const WIDE_COLUMN = 'space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pb-1 [&>section]:mx-0';

/**
 * The large view of a branch with a PR (or about to get one). Review gets the wide column since
 * it's mostly reading and writing; checks and the merge card sit beside it, so merging never
 * needs a scroll past the conversation.
 */
function WidePullRequest({
  project,
  status,
  onRetry,
  before,
}: {
  project: Project;
  status: PullRequestStatus;
  onRetry: () => void;
  before: React.ReactNode;
}): React.JSX.Element {
  const pr = status.pr;

  if (status.error && !pr) {
    return (
      <PanelNotice
        title="Could not read the pull request"
        body={status.error}
        action={{ label: 'Retry', run: onRetry }}
      />
    );
  }

  if (!pr) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {before}
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Open a pull request</h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Say what changed and why, so reviewers know where to look. Checks and reviews show up
              here as soon as it's open.
            </p>
          </div>
          <CreatePrForm project={project} status={status} roomy />
        </div>
      </div>
    );
  }

  if (pr.state !== 'OPEN') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PrOverview pr={pr} />
        <div className="mx-auto w-full max-w-3xl space-y-3 px-5 py-4 [&_section]:mx-0">
          {before}
          <FinishedPr project={project} pr={pr} status={status} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
      <PrOverview pr={pr} />
      <div className="grid gap-4 px-5 py-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className={WIDE_COLUMN}>
          {before}
          <PrReview project={project} pr={pr} />
        </div>
        <div className={WIDE_COLUMN}>
          <PrChecks
            project={project}
            pr={pr}
            repo={`${status.github?.owner}/${status.github?.repo}`}
          />
          <MergeCard project={project} pr={pr} status={status} />
        </div>
      </div>
    </div>
  );
}

/**
 * The workspace Pull request tab. Walks the current branch from "no PR" through checks and
 * review to a merge, and says plainly what's missing when it can't (no gh, signed out...).
 */
export function PullRequestSection({
  project,
  status,
  loading,
  onRetry,
  onNewBranch,
  wide = false,
}: {
  project: Project;
  status: PullRequestStatus | undefined;
  loading: boolean;
  onRetry: () => void;
  onNewBranch: () => void;
  /** The large view: review beside checks and merge, with a status strip on top. */
  wide?: boolean;
}): React.JSX.Element {
  const navigate = useNavigate();
  const openSession = useTerminalStore((s) => s.openSession);
  const recent = useRecentMerges((s) => s.byProject[project.id]);

  if (!status) {
    if (loading) return <LoadingCards />;
    return (
      <PanelNotice
        title="Could not read the pull request"
        body="Try again in a moment."
        action={{ label: 'Retry', run: onRetry }}
      />
    );
  }
  if (!status.cliAvailable) {
    return (
      <PanelNotice
        title="GitHub CLI not found"
        body="Install gh to create, review and merge pull requests here."
        action={{ label: 'Open Agent Tools', run: () => navigate('/tools') }}
      />
    );
  }
  if (!status.github) {
    return <PanelNotice title="No GitHub remote" body="This repository is not hosted on GitHub." />;
  }
  if (!status.authenticated) {
    return (
      <PanelNotice
        title="Sign in to GitHub"
        body="gh needs to be signed in to work with pull requests."
        action={{
          label: 'Run gh auth login',
          run: () => openSession({ title: 'GitHub sign in', initialInput: 'gh auth login' }),
        }}
      />
    );
  }

  const recentCard =
    recent && recent.head !== status.branch ? (
      <RecentMergeCard project={project} merge={recent} />
    ) : null;

  if (!status.branch) {
    return (
      <PanelNotice
        icon={GitBranch}
        title="No branch checked out"
        body="Check out a branch to open a pull request for it."
      />
    );
  }
  if (status.onDefaultBranch) {
    return (
      <div className="space-y-2 py-2">
        {recentCard}
        <div className="flex flex-col items-center gap-1.5 px-5 py-4 text-center">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium">Pull requests start from a branch</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            You are on {status.branch}. Create a branch for your change, commit to it, and open the
            pull request here.
          </p>
          <button
            type="button"
            onClick={onNewBranch}
            className="mt-1 inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-all hover:brightness-110"
          >
            <GitBranch className="h-2.5 w-2.5" />
            New branch
          </button>
        </div>
      </div>
    );
  }

  if (wide) {
    return (
      <WidePullRequest project={project} status={status} onRetry={onRetry} before={recentCard} />
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-3 pt-1">
      {recentCard}
      {status.error && !status.pr ? (
        <PanelNotice
          title="Could not read the pull request"
          body={status.error}
          action={{ label: 'Retry', run: onRetry }}
        />
      ) : !status.pr ? (
        <CreatePrForm project={project} status={status} />
      ) : status.pr.state !== 'OPEN' ? (
        <>
          <PrHeader pr={status.pr} />
          <FinishedPr project={project} pr={status.pr} status={status} />
        </>
      ) : (
        <>
          <PrHeader pr={status.pr} />
          <PrChecks
            project={project}
            pr={status.pr}
            repo={`${status.github.owner}/${status.github.repo}`}
          />
          <PrReview project={project} pr={status.pr} />
          <MergeCard project={project} pr={status.pr} status={status} />
        </>
      )}
    </div>
  );
}
