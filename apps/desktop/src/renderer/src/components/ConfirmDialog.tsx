import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { resolveConfirm, useConfirmStore } from '@/stores/confirmStore';

/** Renders the shared confirmation modal driven by confirmDialog(); mount once near the app root. */
export function ConfirmDialogHost(): React.JSX.Element {
  const { open, title, description, confirmLabel, cancelLabel, variant } = useConfirmStore();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && resolveConfirm(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => resolveConfirm(false)}>
            {cancelLabel}
          </Button>
          <Button variant={variant === 'destructive' ? 'destructive' : 'default'} onClick={() => resolveConfirm(true)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
