import { coreErrorMessage } from '@shared/coreErrors';
import type { StreamProxyInfo } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { CircleCheck, Clock, Pencil, Plus, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { confirmDialog } from '@/stores/confirmStore';
import { StreamProxyDialog } from './StreamProxyDialog';

/** Public TCP and UDP ports nginx passes on, each with who may connect. */

export function StreamProxiesCard({
  serverId,
  proxies,
  loading,
  error,
  admin,
  available,
  onChanged,
}: {
  serverId: string;
  proxies: StreamProxyInfo[] | undefined;
  loading: boolean;
  error: string | null;
  admin: boolean;
  /** nginx is managed and has its stream module. */
  available: boolean;
  onChanged: () => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState<StreamProxyInfo | 'new' | null>(null);

  async function remove(proxy: StreamProxyInfo): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Delete the ${proxy.settings.protocol.toUpperCase()} proxy on port ${proxy.settings.listenPort}?`,
      description: 'Connections to that port stop with the next apply.',
      confirmLabel: 'Delete the proxy',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await window.agentmat.deploySites.removeStream(serverId, proxy.settings.id);
      toast.success('Proxy deleted. Apply to close the port.');
      onChanged();
    } catch (failure) {
      toast.error(coreErrorMessage(failure));
    }
  }

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">TCP and UDP proxies</CardTitle>
          <CardDescription>
            For databases, game servers and anything else that is not a website.
          </CardDescription>
        </div>
        {admin && available && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing('new')}>
            <Plus className="h-3.5 w-3.5" /> Add a proxy
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-10 w-full" aria-busy="true" />
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : !proxies || proxies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No TCP or UDP proxies.</p>
        ) : (
          <ul aria-label="Stream proxies" className="divide-y divide-border/60">
            {proxies.map((proxy) => {
              const s = proxy.settings;
              const name = `${s.protocol.toUpperCase()} ${s.listenPort}`;
              return (
                <li
                  key={s.id}
                  aria-label={name}
                  className="flex flex-wrap items-center gap-3 py-2 text-sm"
                >
                  <span className="font-mono text-foreground">{name}</span>
                  <span className="text-muted-foreground">to</span>
                  <span className="font-mono text-foreground">{s.upstream.address}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.allowFrom && s.allowFrom.length > 0
                      ? `${s.allowFrom.length} allowed ${s.allowFrom.length === 1 ? 'address' : 'addresses'}`
                      : 'open to anyone'}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    {proxy.applied ? (
                      <>
                        <CircleCheck className="h-3 w-3 text-success" /> Live
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 text-warning" /> Not applied yet
                      </>
                    )}
                  </span>
                  {admin && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${name}`}
                        onClick={() => setEditing(proxy)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${name}`}
                        onClick={() => void remove(proxy)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <StreamProxyDialog
        serverId={serverId}
        proxy={editing === 'new' ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          toast.success('Proxy saved. Apply to open the port.');
          onChanged();
        }}
      />
    </Card>
  );
}
