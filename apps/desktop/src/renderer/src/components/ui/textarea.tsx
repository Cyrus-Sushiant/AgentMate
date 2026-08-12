import * as React from 'react';
import { containsPersian } from '@/lib/rtl';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, value, ...props }, ref) => {
  const isPersian = typeof value === 'string' && containsPersian(value);
  return (
    <textarea
      value={value}
      dir={isPersian ? 'rtl' : undefined}
      ref={ref}
      className={cn(
        'flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)] transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        isPersian && 'font-vazirmatn',
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
