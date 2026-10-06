import * as React from 'react';
import { containsPersian } from '@/lib/rtl';
import { cn } from '@/lib/utils';
import { FIELD_SURFACE } from './input';

/**
 * The corner every multi-line field uses. At the single-line height (h-9) it is exactly a pill,
 * so a box that grows from one line keeps the search pills' shape until it wraps.
 */
export const MULTILINE_FIELD_RADIUS = 'rounded-[calc(var(--radius)+6px)]';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * `bare` drops the field surface, for a textarea inside a container that already draws one,
   * like a chat composer. Utilities can't strip it, since the rule is unlayered.
   */
  variant?: 'default' | 'bare';
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, variant = 'default', ...props }, ref) => {
    const isPersian = typeof value === 'string' && containsPersian(value);
    return (
      <textarea
        value={value}
        dir={isPersian ? 'rtl' : undefined}
        ref={ref}
        // Explicit so a misspelled word is underlined no matter what an ancestor
        // sets; fields that hold paths or arguments pass spellCheck={false}.
        spellCheck
        className={cn(
          'flex min-h-20 w-full px-3.5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'bare'
            ? 'bg-transparent outline-none placeholder:text-muted-foreground/70'
            : cn(FIELD_SURFACE, MULTILINE_FIELD_RADIUS),
          isPersian && 'font-vazirmatn',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
