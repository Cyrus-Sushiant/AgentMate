import { formatBytes } from '@shared/remoteProtocol';
import { Broadcast, Link } from '@/components/icons';
import { ControllerPanel } from '@/components/remote/ControllerPanel';
import { HostPanel } from '@/components/remote/HostPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useRemoteStore } from '@/stores/remoteStore';

const LOG_COLOR = {
  info: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
} as const;

export default function RemotePage(): React.JSX.Element {
  const logs = useRemoteStore((s) => s.logs);
  const transfers = useRemoteStore((s) => s.transfers);

  usePageHeader(
    'Remote',
    'Control another AgentMate over your local network, AnyDesk-style, over WebSockets.',
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6">
      <Tabs defaultValue="host" className="flex flex-col gap-4">
        <TabsList containerClassName="self-start">
          <TabsTrigger value="host" className="gap-1.5">
            <Broadcast className="h-3.5 w-3.5" /> Host
          </TabsTrigger>
          <TabsTrigger value="connect" className="gap-1.5">
            <Link className="h-3.5 w-3.5" /> Connect
          </TabsTrigger>
        </TabsList>
        <TabsContent value="host" className="mt-0">
          <HostPanel />
        </TabsContent>
        <TabsContent value="connect" className="mt-0">
          <ControllerPanel />
        </TabsContent>
      </Tabs>

      {transfers.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle>File transfers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {transfers.map((t) => {
              const pct = t.total > 0 ? Math.round((t.transferred / t.total) * 100) : 0;
              return (
                <div key={t.transferId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium">
                      {t.direction === 'incoming' ? '↓' : '↑'} {t.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                      {t.resuming && <span className="text-warning">Reconnecting…</span>}
                      {t.error
                        ? t.error
                        : t.done
                          ? (t.verified ?? true)
                            ? 'Verified ✓'
                            : 'Hash mismatch ✗'
                          : `${formatBytes(t.transferred)} / ${formatBytes(t.total)}`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        t.error || t.verified === false ? 'bg-destructive' : 'bg-primary',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {logs.map((log, i) => (
                <li key={`${log.at}-${i}`} className={cn('flex gap-2', LOG_COLOR[log.level])}>
                  <span className="shrink-0 text-muted-foreground/60">
                    {new Date(log.at).toLocaleTimeString()}
                  </span>
                  <span>{log.message}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
