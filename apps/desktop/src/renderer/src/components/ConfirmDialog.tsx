import { useId } from 'react';
import { File, Folder, TriangleAlert } from '@/components/icons';
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
import {
  type ConfirmItem,
  resolveConfirm,
  setConfirmTyped,
  useConfirmStore,
} from '@/stores/confirmStore';

function ItemList({
  items,
  moreCount,
}: {
  items: ConfirmItem[];
  moreCount?: number;
}): React.JSX.Element {
  return (
    <ul className="max-h-56 min-h-0 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 py-1 text-sm">
      {items.map((item) => (
        <li
          key={`${item.detail ?? ''}/${item.name}`}
          className="flex min-w-0 items-center gap-2 px-3 py-1.5"
        >
          {item.isDirectory ? (
            <Folder className="h-3.5 w-3.5 shrink-0 text-primary/60" />
          ) : (
            <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 truncate font-medium text-foreground">{item.name}</span>
          {item.detail && (
            <span className="min-w-0 shrink-[4] truncate text-xs text-muted-foreground/70">
              {item.detail}
            </span>
          )}
        </li>
      ))}
      {moreCount ? (
        <li className="px-3 py-1.5 text-xs text-muted-foreground">and {moreCount} more</li>
      ) : null}
    </ul>
  );
}

/** Renders the shared confirmation modal driven by confirmDialog(); mount once near the app root. */
export function ConfirmDialogHost(): React.JSX.Element {
  const {
    open,
    title,
    description,
    items,
    moreCount,
    warning,
    icon: Icon,
    confirmLabel,
    cancelLabel,
    variant,
    typeToConfirm,
    typed,
  } = useConfirmStore();
  const destructive = variant === 'destructive';
  const typedId = useId();
  const waitingForText = typeToConfirm !== undefined && typed !== typeToConfirm;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && resolveConfirm(false)}>
      <DialogContent className={cn(Icon && 'max-w-md')}>
        <div className={cn(Icon && 'flex items-start gap-4')}>
          {Icon && (
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                destructive ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary',
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
          <DialogHeader className={cn('min-w-0 pr-6', Icon && 'pt-1')}>
            <DialogTitle className="break-words leading-snug">{title}</DialogTitle>
            {description && (
              <DialogDescription className="whitespace-pre-line">{description}</DialogDescription>
            )}
          </DialogHeader>
        </div>
        {(Boolean(items?.length) || Boolean(warning)) && (
          <div className="flex min-h-0 flex-col gap-3">
            {items && items.length > 0 && <ItemList items={items} moreCount={moreCount} />}
            {warning && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{warning}</span>
              </div>
            )}
          </div>
        )}
        {typeToConfirm !== undefined && (
          <div className="space-y-1.5">
            <Label htmlFor={typedId} className="text-sm font-normal">
              Type <span className="font-mono font-semibold">{typeToConfirm}</span> to confirm
            </Label>
            <Input
              id={typedId}
              value={typed}
              onChange={(event) => setConfirmTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => resolveConfirm(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={waitingForText}
            onClick={() => resolveConfirm(true)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
