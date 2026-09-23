import type { Project, PullRequestInfo } from '@agentmat/core';
import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Spinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Phase =
  | { kind: 'reviewing' }
  | { kind: 'ready'; cliName: string | null }
  | { kind: 'failed'; error: string };

/**
 * Has the project's CLI read the PR diff and write a review, read-only, then lets the user edit
 * it before it is posted. Nothing reaches GitHub without that last look.
 */
export function LocalReviewDialog({
  project,
  pr,
  open,
  onOpenChange,
  onPost,
}: {
  project: Project;
  pr: PullRequestInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPost: (body: string) => Promise<boolean>;
}): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'reviewing' });
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const requestRef = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a run starts per opening or retry, not per render
  useEffect(() => {
    if (!open) return;
    const requestId = crypto.randomUUID();
    requestRef.current = requestId;
    setPhase({ kind: 'reviewing' });
    void window.agentmat.pullRequests.localReview(project.id, requestId).then((result) => {
      if (requestRef.current !== requestId || result.cancelled) return;
      requestRef.current = null;
      if (result.ok && result.text) {
        setText(result.text.trim());
        setPhase({ kind: 'ready', cliName: result.cliName ?? null });
      } else {
        setPhase({ kind: 'failed', error: result.error ?? 'The CLI did not return a review.' });
      }
    });
    return () => {
      if (requestRef.current === requestId) {
        void window.agentmat.pullRequests.cancelAi(requestId);
        requestRef.current = null;
      }
    };
  }, [open, attempt]);

  async function post(): Promise<void> {
    setPosting(true);
    try {
      if (await onPost(text.trim())) onOpenChange(false);
    } finally {
      setPosting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review #{pr.number} with AI</DialogTitle>
          <DialogDescription>
            {phase.kind === 'ready' && phase.cliName
              ? `${phase.cliName} reviewed the diff without changing any files. Edit the review, then post it on the pull request.`
              : 'The project CLI reads the diff without changing any files. You can edit the review before it is posted.'}
          </DialogDescription>
        </DialogHeader>

        {phase.kind === 'failed' ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-[12px]">
            <p className="font-medium text-destructive">Could not review the pull request</p>
            <p className="mt-0.5 text-muted-foreground">{phase.error}</p>
          </div>
        ) : (
          <textarea
            value={text}
            aria-label="AI review"
            aria-busy={phase.kind === 'reviewing'}
            disabled={phase.kind === 'reviewing'}
            placeholder={phase.kind === 'reviewing' ? 'Reading the diff…' : ''}
            onChange={(event) => setText(event.target.value)}
            rows={14}
            className={cn(
              'block w-full resize-y rounded-lg border border-input bg-background/60 px-3 py-2 font-mono text-[12px] leading-relaxed outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15',
              phase.kind === 'reviewing' && 'shimmer',
            )}
          />
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {phase.kind === 'failed' ? (
            <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          ) : null}
          <Button
            onClick={() => void post()}
            disabled={phase.kind !== 'ready' || !text.trim() || posting}
          >
            {posting || phase.kind === 'reviewing' ? (
              <Spinner className="mr-1.5 h-3 w-3 animate-spin motion-reduce:animate-none" />
            ) : (
              <MessageSquare className="mr-1.5 h-3 w-3" />
            )}
            {phase.kind === 'reviewing' ? 'Reviewing…' : 'Post as comment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
