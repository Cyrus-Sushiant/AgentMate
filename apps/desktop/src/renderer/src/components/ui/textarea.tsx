import * as React from 'react';
import { cn } from '@/lib/utils';
import { containsPersian } from '@/lib/rtl';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, value, ...props }, ref) => {
    const isPersian = typeof value === 'string' && containsPersian(value);
    return (
      <textarea
        value={value}
        dir={isPersian ? 'rtl' : undefined}
        ref={ref}
        className={cn(
          'flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
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
