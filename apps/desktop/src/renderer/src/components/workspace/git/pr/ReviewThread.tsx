import type { PrReviewComment, PrReviewThread } from '@agentmat/core';
import { useState } from 'react';
import { Check, MessageSquare, Send, Spinner, Undo } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { isSubmitKey, PR_GHOST_BUTTON } from './PrCard';

function Comment({ comment }: { comment: PrReviewComment }): React.JSX.Element {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground">
        <span className="font-semibold text-foreground/85">@{comment.author}</span>
        {comment.createdAt ? ` · ${timeAgo(comment.createdAt)}` : null}
      </p>
      <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed">{comment.body}</p>
    </div>
  );
}

/** One review thread: where it is, the latest comment, and reply / resolve right there. */
export function ReviewThread({
  thread,
  onReply,
  onResolve,
}: {
  thread: PrReviewThread;
  onReply: (body: string) => Promise<boolean>;
  onResolve: (resolved: boolean) => void;
}): React.JSX.Element {
  const [showEarlier, setShowEarlier] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const where = thread.line ? `${thread.path}:${thread.line}` : thread.path;
  const earlier = thread.comments.slice(0, -1);
  const latest = thread.comments.at(-1);

  async function send(): Promise<void> {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      if (await onReply(reply.trim())) {
        setReply('');
        setReplying(false);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <li
      className={cn(
        'mx-2 space-y-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-2',
        thread.isResolved && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-1.5">
        <SimpleTooltip label={where} wrapTrigger>
          <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-muted-foreground">
            {where}
          </span>
        </SimpleTooltip>
        {thread.isOutdated ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">outdated</span>
        ) : null}
      </div>

      {earlier.length > 0 && !showEarlier ? (
        <button
          type="button"
          onClick={() => setShowEarlier(true)}
          className="text-[10.5px] font-medium text-primary hover:underline"
        >
          Show {earlier.length} earlier {earlier.length === 1 ? 'comment' : 'comments'}
        </button>
      ) : null}
      {showEarlier
        ? earlier.map((comment) => (
            <Comment key={comment.url || comment.createdAt} comment={comment} />
          ))
        : null}
      {latest ? <Comment comment={latest} /> : null}

      {replying ? (
        <div className="space-y-1">
          <textarea
            autoFocus
            rows={2}
            value={reply}
            aria-label={`Reply to ${where}`}
            placeholder="Reply… (Ctrl+Enter to send)"
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={(event) => {
              if (isSubmitKey(event)) {
                event.preventDefault();
                void send();
              } else if (event.key === 'Escape') {
                setReplying(false);
              }
            }}
            className="block w-full resize-y rounded-md border border-input bg-background/60 px-2 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
          <div className="flex justify-end gap-1">
            <button type="button" onClick={() => setReplying(false)} className={PR_GHOST_BUTTON}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={!reply.trim() || sending}
              className="inline-flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
            >
              {sending ? (
                <Spinner className="h-2.5 w-2.5 animate-spin motion-reduce:animate-none" />
              ) : (
                <Send className="h-2.5 w-2.5" />
              )}
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1">
          <button type="button" onClick={() => setReplying(true)} className={PR_GHOST_BUTTON}>
            <MessageSquare className="h-2.5 w-2.5" />
            Reply
          </button>
          <button
            type="button"
            aria-label={`${thread.isResolved ? 'Unresolve' : 'Resolve'} ${where}`}
            onClick={() => onResolve(!thread.isResolved)}
            className={PR_GHOST_BUTTON}
          >
            {thread.isResolved ? (
              <Undo className="h-2.5 w-2.5" />
            ) : (
              <Check className="h-2.5 w-2.5" />
            )}
            {thread.isResolved ? 'Unresolve' : 'Resolve'}
          </button>
        </div>
      )}
    </li>
  );
}
