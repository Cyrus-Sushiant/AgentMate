import type { RemoteFileProgress } from '@shared/apiTypes';
import { formatBytes } from '@shared/remoteProtocol';
import { Download, Upload } from '@/components/icons';
import { Chip, SECTION_HEADING } from '@/components/pageKit';
import { cn } from '@/lib/utils';

/**
 * Files moving to or from the remote machine, as hairline rows in one glass card: the name, a
 * status chip once it is done, and a thin progress bar while it is not.
 */
export function TransfersCard({
  title,
  transfers,
  showParts = false,
  assumeVerified = false,
  className,
}: {
  title: string;
  transfers: RemoteFileProgress[];
  /** Shows how many of the resumable parts are done, for the file manager's bigger transfers. */
  showParts?: boolean;
  /** Reads a finished transfer with no hash result as verified (older peers never send one). */
  assumeVerified?: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <section
      aria-label={title}
      className={cn(
        'glass flex min-h-0 flex-col overflow-hidden rounded-[calc(var(--radius)+2px)]',
        className,
      )}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 px-4">
        <h2 className={SECTION_HEADING}>{title}</h2>
        <span className="rounded-full bg-foreground/[0.06] px-1.5 text-[10px] font-semibold leading-4 tabular-nums text-muted-foreground">
          {transfers.length}
        </span>
      </div>
      <ul className="settings-rows rail-scroll min-h-0 overflow-y-auto">
        {transfers.map((t) => {
          const pct = t.total > 0 ? Math.round((t.transferred / t.total) * 100) : 0;
          const verified = t.verified ?? (assumeVerified ? true : undefined);
          const failed = Boolean(t.error) || (t.done && verified !== true);
          const Icon = t.direction === 'incoming' ? Download : Upload;
          return (
            <li key={t.transferId} className="flex flex-col gap-1.5 px-4 py-2.5">
              <div className="flex items-center gap-2.5 text-xs">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                    failed ? 'bg-destructive/12 text-destructive' : 'bg-primary/12 text-primary',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span className="sr-only">
                    {t.direction === 'incoming' ? 'Downloading' : 'Uploading'}
                  </span>
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                  {t.resuming && <Chip tone="warning">Reconnecting…</Chip>}
                  {showParts && t.partsTotal !== undefined && (
                    <span className="tabular-nums">
                      {t.partsCompleted ?? 0}/{t.partsTotal} parts
                    </span>
                  )}
                  {t.error ? (
                    <span className="text-destructive">{t.error}</span>
                  ) : t.done ? (
                    verified ? (
                      <Chip tone="success">Verified</Chip>
                    ) : (
                      <Chip tone="destructive">Hash mismatch</Chip>
                    )
                  ) : (
                    <span className="tabular-nums">{`${formatBytes(t.transferred)} / ${formatBytes(t.total)}`}</span>
                  )}
                </span>
              </div>
              {!t.done && !t.error ? (
                <div
                  role="progressbar"
                  aria-label={`${t.name} progress`}
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="ml-8.5 h-1 overflow-hidden rounded-full bg-foreground/[0.08]"
                >
                  <div
                    className="h-full rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)] transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
