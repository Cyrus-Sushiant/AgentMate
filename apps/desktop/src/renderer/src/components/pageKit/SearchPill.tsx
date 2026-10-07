import { forwardRef } from 'react';
import { Search, X } from '@/components/icons';
import { cn } from '@/lib/utils';

interface SearchPillProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'> {
  value: string;
  onValueChange: (value: string) => void;
  /** The accessible name of the box. */
  label: string;
  /** The accessible name of the clear button. */
  clearLabel?: string;
  /** Classes for the pill around the input. */
  className?: string;
  inputClassName?: string;
  /** Anything that belongs inside the pill after the input, like a browse button. */
  trailing?: React.ReactNode;
}

/**
 * The soft search box the title bar and the API Client sidebar use: a pill with a faint wash of
 * the text colour, a clear button once something is typed, and Escape to clear. A list filter
 * passes `type="search"` and `clearLabel="Clear filter"`.
 */
export const SearchPill = forwardRef<HTMLInputElement, SearchPillProps>(function SearchPill(
  {
    value,
    onValueChange,
    label,
    clearLabel = 'Clear search',
    className,
    inputClassName,
    trailing,
    onKeyDown,
    ...inputProps
  },
  ref,
) {
  return (
    <div
      className={cn(
        'search-pill flex h-8 min-w-0 items-center gap-2 rounded-full pl-3 pr-1 transition-colors',
        // The edge alone is too quiet to find the caret by, so keyboard focus in the box also
        // gets the soft ring a form field draws (see .field-surface). The input has no outline of
        // its own, so the ring goes on the pill around it.
        'has-[input:focus-visible]:shadow-[0_0_0_3px_hsl(var(--ring)/0.22)]',
        className,
      )}
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        ref={ref}
        type="text"
        aria-label={label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            event.stopPropagation();
            onValueChange('');
          }
          onKeyDown?.(event);
        }}
        spellCheck={false}
        autoComplete="off"
        className={cn(
          // A `type="search"` box would otherwise draw Chromium's own clear button beside ours.
          'h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:appearance-none',
          inputClassName,
        )}
        {...inputProps}
      />
      {value && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onValueChange('')}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {trailing}
    </div>
  );
});
