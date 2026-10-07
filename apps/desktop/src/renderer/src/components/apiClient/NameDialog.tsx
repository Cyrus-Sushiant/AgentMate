import { useEffect, useId, useState } from 'react';
import { TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Matches what main accepts for collection and folder names. */
const MAX_NAME_LENGTH = 120;

interface NameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Shown in the tile beside the title. */
  icon?: React.ReactNode;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  onSubmit: (name: string) => Promise<void>;
}

/** Asks for one name: a new collection or folder, or a rename. */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  label,
  initialValue = '',
  placeholder,
  confirmLabel,
  onSubmit,
}: NameDialogProps): React.JSX.Element {
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
    }
  }, [open, initialValue]);

  const name = value.trim();
  const unchanged = initialValue !== '' && name === initialValue.trim();

  async function submit(): Promise<void> {
    if (!name || busy || unchanged) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row items-center gap-3 border-b border-border/70 px-6 py-5">
          {icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary [&_svg]:h-[18px] [&_svg]:w-[18px]">
              {icon}
            </span>
          )}
          <div className="min-w-0 space-y-1 pr-8">
            <DialogTitle className="text-base">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="text-xs leading-relaxed">
                {description}
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{label}</DialogDescription>
            )}
          </div>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2 px-6 py-5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor={inputId} className="text-xs font-semibold">
                {label}
              </Label>
              <span
                className={cn(
                  'text-[11px] tabular-nums text-muted-foreground',
                  value.length >= MAX_NAME_LENGTH && 'text-amber-600 dark:text-amber-400',
                )}
              >
                {value.length}/{MAX_NAME_LENGTH}
              </span>
            </div>
            <Input
              id={inputId}
              value={value}
              maxLength={MAX_NAME_LENGTH}
              placeholder={placeholder}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              aria-invalid={error !== null}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              className="h-10"
            />
            {error && (
              <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="items-center border-t border-border/70 bg-muted/20 px-6 py-3.5 sm:justify-between">
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Press{' '}
              <kbd className="rounded border border-border bg-background px-1 py-px font-mono text-[10px]">
                Enter
              </kbd>{' '}
              to {confirmLabel.toLowerCase()}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="soft" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!name || busy || unchanged}
                className="min-w-20"
              >
                {busy ? 'Saving…' : confirmLabel}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
