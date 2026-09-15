import { formatBytes } from '@shared/remoteProtocol';
import { useState } from 'react';
import { Broadcast, Link, Server } from '@/components/icons';
import { ControllerPanel } from '@/components/remote/ControllerPanel';
import { HostPanel } from '@/components/remote/HostPanel';
import { SshServersPanel } from '@/components/remote/SshServersPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GooeyNav } from '@/components/ui/gooey-nav';
import { cn } from '@/lib/utils';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useRemoteStore } from '@/stores/remoteStore';

const REMOTE_TABS = ['host', 'connect', 'ssh'] as const;
type RemoteTab = (typeof REMOTE_TABS)[number];

const LOG_COLOR = {
  info: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
} as const;

export default function RemotePage(): React.JSX.Element {
  const logs = useRemoteStore((s) => s.logs);
  const transfers = useRemoteStore((s) => s.transfers);
  const [activeTab, setActiveTab] = useState<RemoteTab>('host');

  usePageHeader(
    'Remote',
    'Control another AgentMate over your local network, AnyDesk-style, over WebSockets.',
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6">
      <GooeyNav
        size="sm"
        className="self-start"
        aria-label="Remote views"
        items={[
          { label: 'Host', icon: <Broadcast /> },
          { label: 'Connect', icon: <Link /> },
          { label: 'SSH', icon: <Server /> },
        ]}
        value={REMOTE_TABS.indexOf(activeTab)}
        onChange={(index) => setActiveTab(REMOTE_TABS[index])}
      />
      {activeTab === 'host' && <HostPanel />}
      {activeTab === 'connect' && <ControllerPanel />}
      {activeTab === 'ssh' && <SshServersPanel />}

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
