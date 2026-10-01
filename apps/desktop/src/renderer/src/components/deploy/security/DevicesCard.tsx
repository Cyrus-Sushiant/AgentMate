import { coreErrorMessage } from '@shared/coreErrors';
import type { DeviceInfo } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type { DeployServer } from '@shared/deployTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, CircleCheck, Monitor, RefreshCw } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import { confirmDialog } from '@/stores/confirmStore';
import { SetupFailure } from '../SetupFailure';
import { ago } from './format';

/**
 * The computers enrolled on a core, this one marked. Every role sees its own; Admins and Owners
 * see everyone's (the core decides which). Revoking one ends its sessions at once, and it has to
 * enroll again before it can sign in.
 */
export function DevicesCard({
  server,
  everyone,
}: {
  server: DeployServer;
  /** The signed-in role sees every user's devices, so each row says whose it is. */
  everyone: boolean;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const devices = useQuery({
    queryKey: queryKeys.deployDevices(server.id),
    queryFn: () => window.agentmat.deploySecurity.listDevices(server.id),
    retry: false,
  });

  async function revoke(device: DeviceInfo): Promise<void> {
    const confirmed = await confirmDialog({
      title: device.current ? 'Revoke this computer?' : `Revoke ${device.name}?`,
      description: device.current
        ? 'This computer is signed out of the core and has to enroll again (over SSH, or with an enrollment code) before it can manage the server.'
        : `${device.name} is signed out and cannot sign in again until it enrolls again.`,
      confirmLabel: 'Revoke',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await window.agentmat.deploySecurity.revokeDevice(server.id, device.id);
      toast.success(device.current ? 'This computer is revoked.' : `${device.name} is revoked.`);
    } catch (error) {
      toast.error(coreErrorMessage(error));
    } finally {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deploySecurity(server.id) });
      if (device.current) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.deployAccess(server.id) });
      }
    }
  }

  let body: React.ReactNode;
  if (devices.isPending) {
    body = (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  } else if (devices.isError) {
    body = (
      <div className="space-y-3">
        <SetupFailure message={coreErrorMessage(devices.error)} />
        <Button size="sm" variant="outline" onClick={() => void devices.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  } else if (devices.data.length === 0) {
    body = <p className="text-sm text-muted-foreground">No computers are enrolled on this core.</p>;
  } else {
    // This computer first, revoked ones last; otherwise as the core listed them (oldest first).
    const ordered = [...devices.data].sort(
      (a, b) => Number(b.current) - Number(a.current) || Number(a.revoked) - Number(b.revoked),
    );
    body = (
      <ul
        aria-label="Devices"
        className="divide-y divide-border/60 rounded-lg border border-border/70 bg-secondary/20"
      >
        {ordered.map((device) => (
          <li
            key={device.id}
            aria-label={device.name}
            className={`flex flex-wrap items-center gap-3 px-4 py-3 ${device.revoked ? 'opacity-70' : ''}`}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{device.name}</span>
                {device.current && <Badge variant="outline">This computer</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {[
                  ...(everyone ? [device.userName] : []),
                  `Enrolled ${ago(device.createdAtUnixMs)}`,
                  device.lastSeenAtUnixMs === undefined
                    ? 'Never seen'
                    : `Seen ${ago(device.lastSeenAtUnixMs)}`,
                ].join(' · ')}
              </p>
            </div>
            {device.revoked ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Ban className="h-3.5 w-3.5" />
                Revoked
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                  <CircleCheck className="h-3.5 w-3.5" />
                  Active
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Revoke ${device.name}`}
                  onClick={() => void revoke(device)}
                >
                  Revoke
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-primary" /> Devices
        </CardTitle>
        <CardDescription>
          {everyone
            ? 'Every computer enrolled on this core, whoever it belongs to.'
            : 'Your computers enrolled on this core.'}{' '}
          Each one signs in with a key of its own.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
