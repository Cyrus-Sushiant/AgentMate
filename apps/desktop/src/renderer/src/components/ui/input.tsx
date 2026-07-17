import * as React from 'react';
import { cn } from '@/lib/utils';
import { containsPersian } from '@/lib/rtl';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, value, ...props }, ref) => {
    const isPersian = typeof value === 'string' && containsPersian(value);
    return (
      <input
        type={type}
        value={value}
        dir={isPersian ? 'rtl' : undefined}
        ref={ref}
        className={cn(
          'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
          isPersian && 'font-vazirmatn',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
