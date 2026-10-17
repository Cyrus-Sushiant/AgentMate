import { SECTION_HEADING } from '@/components/pageKit';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** The labelled field and fieldset the health dialogs share, so their forms line up. */

export function Field({
  id,
  label,
  hint,
  error,
  optional = false,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-[11px] text-muted-foreground">Optional</span>}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function described(id: string, error: string | undefined, hint: boolean) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className={cn(SECTION_HEADING, 'mb-2')}>{title}</legend>
      {children}
    </fieldset>
  );
}
