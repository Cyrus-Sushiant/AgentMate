import type {
  ExposureFirewall,
  ExposureInventory,
  ExposureScope,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { Globe, Lock, Server, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { EXPOSURE_FIREWALL_LABEL, SCOPE_LABEL } from '@/lib/deploy/firewall/format';
import { cn } from '@/lib/utils';

/**
 * What can be reached on the server: every listening socket and every port Docker publishes,
 * public or not, and what the firewall makes of it. A container published on all addresses
 * goes around the host firewall, so it is called out. Moving one behind nginx ("make private")
 * comes with app deploys and is not available yet; the button says so.
 */

const SCOPE_ICON: Record<ExposureScope, typeof Globe> = {
  public: Globe,
  private: Server,
  local: Lock,
};

function Reach({ scope, firewall }: { scope: ExposureScope; firewall: ExposureFirewall }) {
  const Icon = SCOPE_ICON[scope];
  const risky = firewall === 'bypassed' || (scope === 'public' && firewall === 'off');
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="inline-flex items-center gap-1">
        <Icon
          className={cn('h-3 w-3', scope === 'public' ? 'text-warning' : 'text-muted-foreground')}
        />
        {SCOPE_LABEL[scope]}
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs',
          risky ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {risky && <TriangleAlert className="h-3 w-3" />}
        {EXPOSURE_FIREWALL_LABEL[firewall]}
      </span>
    </span>
  );
}

export function ExposureCard({
  exposure,
  loading,
  error,
}: {
  exposure: ExposureInventory | undefined;
  loading: boolean;
  error: string | null;
}): React.JSX.Element {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Exposure</CardTitle>
        <CardDescription>What listens on the server, and who can reach it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && !exposure ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !exposure ? (
          <p role="alert" className="text-sm text-destructive">
            {error ?? 'What listens on the server could not be read.'}
          </p>
        ) : (
          <>
            <section aria-label="Listening ports">
              <h4 className="mb-1 text-xs font-medium text-muted-foreground">Listening ports</h4>
              {exposure.socketsError ? (
                <p className="text-sm text-destructive">{exposure.socketsError}</p>
              ) : (
                <ul className="divide-y divide-border/60 text-sm">
                  {exposure.sockets.map((socket) => (
                    <li
                      key={`${socket.protocol}-${socket.address}-${socket.port}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5"
                    >
                      <span className="w-40 font-mono tabular-nums">
                        {socket.address.includes(':') ? `[${socket.address}]` : socket.address}:
                        {socket.port}/{socket.protocol}
                      </span>
                      <span className="w-28 truncate text-muted-foreground">
                        {socket.process ?? 'Unknown'}
                      </span>
                      <Reach scope={socket.scope} firewall={socket.firewall} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-label="Container ports">
              <h4 className="mb-1 text-xs font-medium text-muted-foreground">Container ports</h4>
              {!exposure.dockerAvailable ? (
                <p className="text-sm text-muted-foreground">
                  {exposure.dockerError ?? 'Docker is not running on this server.'}
                </p>
              ) : exposure.containers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No container publishes a port.</p>
              ) : (
                <ul className="divide-y divide-border/60 text-sm">
                  {exposure.containers.some((port) => port.firewall === 'bypassed') && (
                    <li className="pb-1.5 text-xs text-muted-foreground">
                      Docker publishes these ports around the host firewall, so its rules do not
                      apply to them. Making them private from here is not available yet.
                    </li>
                  )}
                  {exposure.containers.map((port) => (
                    <li
                      key={`${port.containerId}-${port.hostAddress}-${port.hostPort}`}
                      aria-label={port.containerName}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5"
                    >
                      <span className="w-40 truncate font-medium">{port.containerName}</span>
                      <span className="w-40 font-mono text-xs tabular-nums">
                        {port.hostAddress}:{port.hostPort} to {port.containerPort}/{port.protocol}
                      </span>
                      <Reach scope={port.scope} firewall={port.firewall} />
                      {port.scope !== 'local' && (
                        <SimpleTooltip
                          label="Not available yet: making a container private comes with app deploys. For now, publish it on 127.0.0.1 in its compose file."
                          className="max-w-64"
                          wrapTrigger
                        >
                          <Button size="sm" variant="ghost" disabled className="ml-auto">
                            Make private
                          </Button>
                        </SimpleTooltip>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
