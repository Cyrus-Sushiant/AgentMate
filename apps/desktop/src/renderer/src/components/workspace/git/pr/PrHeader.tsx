import type { PullRequestInfo } from '@agentmat/core';
import { ExternalLink } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { PrPill, type PrTone } from './PrCard';

function statePill(pr: PullRequestInfo): { label: string; tone: PrTone } {
  if (pr.state === 'MERGED') return { label: 'Merged', tone: 'success' };
  if (pr.state === 'CLOSED') return { label: 'Closed', tone: 'destructive' };
  if (pr.isDraft) return { label: 'Draft', tone: 'default' };
  return { label: 'Open', tone: 'success' };
}

/** Number, title, state and size of the PR, with a way out to GitHub. */
export function PrHeader({ pr }: { pr: PullRequestInfo }): React.JSX.Element {
  const pill = statePill(pr);
  return (
    <header className="space-y-1 px-3 pb-1 pt-2">
      <div className="flex items-start gap-1.5">
        <h3 className="min-w-0 flex-1 text-[13px] font-semibold leading-snug">
          <span className="mr-1 font-normal text-muted-foreground">#{pr.number}</span>
          <span className="break-words">{pr.title}</span>
        </h3>
        <SimpleTooltip label="Open on GitHub">
          <button
            type="button"
            aria-label="Open on GitHub"
            onClick={() => void window.agentmat.shell.openExternal(pr.url)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        </SimpleTooltip>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <PrPill tone={pill.tone}>{pill.label}</PrPill>
        <span className="min-w-0 truncate font-mono">
          {pr.head} → {pr.base}
        </span>
        <span className="ml-auto shrink-0 tabular-nums">
          <span className="text-success">+{pr.additions}</span>{' '}
          <span className="text-destructive">−{pr.deletions}</span>
        </span>
      </div>
    </header>
  );
}
