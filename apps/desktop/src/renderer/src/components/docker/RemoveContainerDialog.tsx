import type { DockerRemoveOptions } from '@shared/apiTypes';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * A dedicated dialog rather than the shared `confirmDialog()` helper: removing a container has
 * two optional extra steps (image, volumes) that a plain yes/no confirm has no room for.
 */
export function RemoveContainerDialog({
  containerName,
  open,
  removing,
  onOpenChange,
  onConfirm,
}: {
  containerName: string | null;
  open: boolean;
  removing: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: DockerRemoveOptions) => void;
}): React.JSX.Element {
  const [removeVolumes, setRemoveVolumes] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);

  function handleOpenChange(next: boolean): void {
    if (!next) {
      setRemoveVolumes(false);
      setRemoveImage(false);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove {containerName}?</DialogTitle>
          <DialogDescription>
            This stops and permanently removes the container. Anything unsaved inside it is lost.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox
              checked={removeImage}
              disabled={removing}
              onCheckedChange={(checked) => setRemoveImage(checked === true)}
            />
            <span>
              Also remove the image
              <span className="block text-xs text-muted-foreground">
                Skipped if another container or tag still uses it.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox
              checked={removeVolumes}
              disabled={removing}
              onCheckedChange={(checked) => setRemoveVolumes(checked === true)}
            />
            <span>
              Also remove anonymous volumes
              <span className="block text-xs text-muted-foreground">
                Named volumes created outside this container are kept.
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={removing} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={removing}
            onClick={() => onConfirm({ removeVolumes, removeImage })}
          >
            {removing ? 'Removing…' : 'Remove container'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
