import type { GrammarIssue } from '@shared/grammar';
import * as React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useGrammarCheck } from '@/hooks/useGrammarCheck';
import { cn } from '@/lib/utils';
import { GrammarPanel } from './GrammarPanel';
import { GrammarUnderlines } from './GrammarUnderlines';

export interface GrammarTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  /** Controlled value. The check needs the text, so an uncontrolled field can't be used here. */
  value: string;
  /** Turns the check off for this field, e.g. when it holds code rather than prose. */
  grammar?: boolean;
  /** Layout classes for the wrapper the underlines are positioned against. */
  containerClassName?: string;
  /** Hides the issue counter; underlines and the right-click menu still work. */
  hideCounter?: boolean;
}

/**
 * A Textarea that checks what you write: LanguageTool's issues are underlined in
 * place, the counter in the corner opens the review panel, and right-clicking an
 * underline offers the fix. Everything else behaves like the plain Textarea.
 */
export const GrammarTextarea = React.forwardRef<HTMLTextAreaElement, GrammarTextareaProps>(
  ({ grammar = true, containerClassName, hideCounter, className, value, ...props }, ref) => {
    // State rather than a ref: the underlines and the check both need to run once
    // the element exists, and a ref assignment doesn't re-render.
    const [field, setField] = React.useState<HTMLTextAreaElement | null>(null);
    const [activeIssue, setActiveIssue] = React.useState<GrammarIssue | null>(null);

    const setRefs = React.useCallback(
      (element: HTMLTextAreaElement | null) => {
        setField(element);
        if (typeof ref === 'function') ref(element);
        else if (ref) ref.current = element;
      },
      [ref],
    );

    const state = useGrammarCheck({ value, field, enabled: grammar });

    return (
      <div className={cn('group relative', containerClassName)}>
        <Textarea ref={setRefs} value={value} className={className} {...props} />
        <GrammarUnderlines
          field={field}
          value={value}
          issues={state.issues}
          activeIssue={activeIssue}
        />
        {hideCounter ? null : (
          <div
            className={cn(
              'absolute bottom-1.5 right-2 transition-opacity',
              // Out of the way until it has something to report or the field is
              // in use, so it never sits on top of text the user is reading.
              state.issues.length > 0 || state.checking || state.error
                ? 'opacity-100'
                : 'opacity-0 focus-within:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100',
            )}
          >
            <GrammarPanel
              field={field}
              value={value}
              state={state}
              onActiveIssueChange={setActiveIssue}
            />
          </div>
        )}
      </div>
    );
  },
);
GrammarTextarea.displayName = 'GrammarTextarea';
