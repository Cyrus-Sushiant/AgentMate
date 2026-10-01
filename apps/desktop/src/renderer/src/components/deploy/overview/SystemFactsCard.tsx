import type { SystemInfo } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { CircleCheck, Power, Server, TriangleAlert } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatUptime } from '@/lib/deploy/setup';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';

/** What the server is: its hardware, addresses, kernel and clock, and whether it wants a reboot. */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 border-t border-border/60 py-2 first:border-t-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function DiskBar({ used, total }: { used: number; total: number }) {
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <span
      className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-primary/15"
      aria-hidden
    >
      <span
        className={cn(
          'block h-full rounded-full',
          percent >= 90 ? 'bg-destructive' : percent >= 80 ? 'bg-warning' : 'bg-primary',
        )}
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}

export function SystemFactsCard({
  info,
  loading,
  error,
  stale,
  now,
  onReboot,
  rebooting,
}: {
  info: SystemInfo | undefined;
  loading: boolean;
  error: string | null;
  stale: boolean;
  now: number;
  /** Shown to Operators and above. */
  onReboot?: () => void;
  rebooting: boolean;
}): React.JSX.Element {
  return (
    <Card className="glass">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" /> System
          </CardTitle>
          <CardDescription>
            {info ? `${info.hostname}, ${info.os.name}` : 'What the server runs on.'}
          </CardDescription>
        </div>
        {onReboot && (
          <Button size="sm" variant="outline" disabled={rebooting || !info} onClick={onReboot}>
            <Power className="h-3.5 w-3.5" /> Reboot
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : !info ? (
          <p role="alert" className="text-sm text-muted-foreground">
            The server's facts did not load{error ? `: ${error}` : '.'}
          </p>
        ) : (
          <dl className={cn('transition-opacity', stale && 'opacity-50')}>
            {(info.rebootRequired || info.rebootRequiredBy.length > 0) && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  A reboot is waiting
                  {info.rebootRequiredBy.length > 0
                    ? ` for ${info.rebootRequiredBy.join(', ')}`
                    : ''}
                  .
                </span>
              </div>
            )}
            <Row label="Processor">
              {info.cpu.model}
              <span className="block text-xs text-muted-foreground">
                {info.cpu.logicalCores} cores ({info.cpu.physicalCores} physical
                {info.cpu.sockets > 1 ? `, ${info.cpu.sockets} sockets` : ''}), {info.architecture}
              </span>
            </Row>
            <Row label="Memory">
              {formatBytes(info.memoryTotalBytes)}
              <span className="text-muted-foreground">
                {info.swapTotalBytes > 0
                  ? `, swap ${formatBytes(info.swapTotalBytes)}`
                  : ', no swap'}
              </span>
            </Row>
            <Row label="Disks">
              <ul className="space-y-2">
                {info.disks.map((disk) => (
                  <li key={disk.mountPoint}>
                    <span className="font-mono text-xs">{disk.mountPoint}</span>{' '}
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(disk.usedBytes)} used of {formatBytes(disk.totalBytes)},{' '}
                      {formatBytes(disk.availableBytes)} free ({disk.fileSystem})
                    </span>
                    <DiskBar used={disk.usedBytes} total={disk.totalBytes} />
                  </li>
                ))}
              </ul>
            </Row>
            <Row label="Network">
              <ul className="space-y-1">
                {info.networks.map((nic) => (
                  <li key={nic.name} className="text-xs">
                    <span className="font-mono">{nic.name}</span>{' '}
                    <span className="text-muted-foreground">
                      {nic.up ? 'up' : 'down'}
                      {nic.speedMbps ? `, ${nic.speedMbps} Mb/s` : ''}
                    </span>
                    {nic.addresses.length > 0 && (
                      <span className="block break-all font-mono text-muted-foreground">
                        {nic.addresses.join(', ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Row>
            <Row label="Public address">
              <span className="break-all font-mono text-xs">
                {info.publicAddresses.length > 0 ? info.publicAddresses.join(', ') : 'None found'}
              </span>
            </Row>
            <Row label="Kernel">
              <span className="font-mono text-xs">{info.kernel}</span>
            </Row>
            <Row label="Up for">{formatUptime(info.bootedAtUnixMs, now)}</Row>
            <Row label="Clock">
              {info.timeSync.synchronized === false ? (
                <Badge variant="warning" className="gap-1">
                  <TriangleAlert className="h-3 w-3" /> Not in sync
                </Badge>
              ) : info.timeSync.synchronized ? (
                <span className="inline-flex items-center gap-1.5">
                  <CircleCheck className="h-3.5 w-3.5 text-success" /> In sync
                </span>
              ) : (
                'Unknown'
              )}
              <span className="text-xs text-muted-foreground">
                {info.timeSync.timeZone ? `, ${info.timeSync.timeZone}` : ''}
                {info.timeSync.service ? ` (${info.timeSync.service})` : ''}
              </span>
            </Row>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
