import { useState } from 'react';
import { Send } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { SimpleTooltip } from '@/components/ui/tooltip';
import type { AnnotationIntent } from '@/lib/browser/types';
import { cn } from '@/lib/utils';

/**
 * The card that opens next to a picked page element: what the element is, what kind of comment
 * this is, and the comment itself. Add keeps the picker going for the next element; Send adds the
 * comment and sends everything to the agent at once.
 */

export interface CommentDraft {
  comment: string;
  intent: AnnotationIntent;
}

export interface CommentComposerProps {
  label: string;
  selector: string;
  /** The element's screenshot, or null while it is being taken. */
  thumbDataUrl: string | null;
  sendLabel: string;
  initial?: CommentDraft;
  onAdd: (draft: CommentDraft) => void;
  onSend: (draft: CommentDraft) => void;
  onCancel: () => void;
}

const INTENTS: { id: AnnotationIntent; label: string; hint: string; placeholder: string }[] = [
  {
    id: 'change',
    label: 'Change',
    hint: 'Ask the agent to change this element',
    placeholder: 'What should change here?',
  },
  {
    id: 'fix',
    label: 'Fix',
    hint: 'Something is broken here',
    placeholder: 'What is wrong here?',
  },
  {
    id: 'question',
    label: 'Ask',
    hint: 'A question, answered without touching the code',
    placeholder: 'What do you want to know about it?',
  },
];

const MOD = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';

export function CommentComposer({
  label,
  selector,
  thumbDataUrl,
  sendLabel,
  initial,
  onAdd,
  onSend,
  onCancel,
}: CommentComposerProps): React.JSX.Element {
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [intent, setIntent] = useState<AnnotationIntent>(initial?.intent ?? 'change');
  const ready = comment.trim().length > 0;
  const draft = (): CommentDraft => ({ comment: comment.trim(), intent });
  const current = INTENTS.find((one) => one.id === intent) ?? INTENTS[0];

  return (
    <div className="flex w-[21rem] flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-[repeating-conic-gradient(hsl(var(--foreground)/0.06)_0_25%,transparent_0_50%)] bg-[length:8px_8px]">
          {thumbDataUrl ? (
            <img
              src={thumbDataUrl}
              alt="Screenshot of the element"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <Skeleton data-testid="comment-thumb-loading" className="h-full w-full rounded-none" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{label}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">{selector}</p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Kind of comment"
        className="grid grid-cols-3 gap-0.5 rounded-lg bg-foreground/[0.06] p-0.5"
      >
        {INTENTS.map((option) => (
          <SimpleTooltip key={option.id} label={option.hint} delayDuration={500}>
            <button
              type="button"
              role="radio"
              aria-checked={intent === option.id}
              onClick={() => setIntent(option.id)}
              className={cn(
                'h-6 rounded-md text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                intent === option.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          </SimpleTooltip>
        ))}
      </div>

      <Textarea
        autoFocus
        aria-label="Comment"
        value={comment}
        rows={3}
        placeholder={current?.placeholder}
        onChange={(event) => setComment(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
            return;
          }
          if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
          event.preventDefault();
          if (!ready) return;
          if (event.shiftKey) onSend(draft());
          else onAdd(draft());
        }}
        className="min-h-[4.5rem] resize-none text-[13px]"
      />

      <div className="flex items-center gap-1.5">
        <span className="mr-auto text-[10px] text-muted-foreground/80">{MOD}+Enter to add</span>
        <Button variant="ghost" size="sm" className="h-7 px-2.5" onClick={onCancel}>
          Cancel
        </Button>
        <SimpleTooltip label={`Add and send all comments (${MOD}+Shift+Enter)`}>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 [&_svg]:size-3"
            disabled={!ready}
            aria-label={sendLabel}
            onClick={() => onSend(draft())}
          >
            <Send />
            Send
          </Button>
        </SimpleTooltip>
        <Button
          size="sm"
          className="h-7 px-3"
          disabled={!ready}
          aria-label="Add comment"
          onClick={() => onAdd(draft())}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
