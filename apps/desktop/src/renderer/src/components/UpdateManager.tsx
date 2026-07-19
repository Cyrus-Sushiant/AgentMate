import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Download } from '@/components/icons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { confirmDialog } from '@/stores/confirmStore';
import { useUpdateStore } from '@/stores/updateStore';

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drives the update confirm/progress/restart flow off useUpdateStore.
 * Downloads and restarts never happen without an explicit user confirmation
 * — mount once near the app root, alongside ConfirmDialogHost.
 */
export function UpdateManager(): React.JSX.Element {
  const status = useUpdateStore((s) => s.status);
  const downloadPrompted = useRef<Set<string>>(new Set());
  const restartPrompted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (status.state === 'available' && !downloadPrompted.current.has(status.info.version)) {
      downloadPrompted.current.add(status.info.version);
      void (async () => {
        const confirmed = await confirmDialog({
          title: 'Update available',
          description: `AgentMate v${status.info.version} is available. Download and install it now?`,
          confirmLabel: 'Download & install',
          cancelLabel: 'Not now',
        });
        if (!confirmed) return;
        try {
          await window.agentmat.app.downloadUpdate();
        } catch {
          toast.error('Failed to download the update.');
        }
      })();
    }

    if (status.state === 'downloaded' && !restartPrompted.current.has(status.info.version)) {
      restartPrompted.current.add(status.info.version);
      void (async () => {
        const confirmed = await confirmDialog({
          title: 'Update ready to install',
          description: `AgentMate v${status.info.version} has been downloaded. Restart now to finish installing? Otherwise it installs the next time you quit.`,
          confirmLabel: 'Restart now',
          cancelLabel: 'Later',
        });
        if (confirmed) void window.agentmat.app.quitAndInstall();
      })();
    }
  }, [status]);

  const isDownloading = status.state === 'downloading';
  const percent = isDownloading ? Math.min(100, Math.max(0, status.progress.percent)) : 0;

  return (
    <Dialog open={isDownloading}>
      <DialogContent
        className="[&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Downloading update
          </DialogTitle>
          {isDownloading && (
            <DialogDescription>
              AgentMate v{status.info.version} — {percent.toFixed(0)}%
            </DialogDescription>
          )}
        </DialogHeader>
        {isDownloading && (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatMb(status.progress.transferredBytes)} / {formatMb(status.progress.totalBytes)}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
