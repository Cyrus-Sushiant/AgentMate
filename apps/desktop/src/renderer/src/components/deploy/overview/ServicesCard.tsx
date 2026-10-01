import type {
  ManagedService,
  ServiceInfo,
  ServiceState,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { CircleCheck, CircleX, Minus, RotateCw, Spinner, Wrench } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** The services that matter on the server, and a restart for Docker and nginx where they run. */

const STATE_TEXT: Record<ServiceState, string> = {
  active: 'Running',
  reloading: 'Reloading',
  inactive: 'Stopped',
  failed: 'Failed',
  activating: 'Starting',
  deactivating: 'Stopping',
  notInstalled: 'Not installed',
  unknown: 'Unknown',
};

function StateMark({ state }: { state: ServiceState }): React.JSX.Element {
  if (state === 'active') return <CircleCheck className="h-3.5 w-3.5 text-success" />;
  if (state === 'failed') return <CircleX className="h-3.5 w-3.5 text-destructive" />;
  if (state === 'reloading' || state === 'activating' || state === 'deactivating') {
    return <Spinner className="h-3.5 w-3.5 text-muted-foreground motion-safe:animate-spin" />;
  }
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

/** Which units the core restarts for the app, by the name it takes. */
export function managedService(service: ServiceInfo): ManagedService | null {
  if (service.unit === 'docker.service') return 'docker';
  if (service.unit === 'nginx.service') return 'nginx';
  return null;
}

export function ServicesCard({
  services,
  loading,
  error,
  stale,
  restarting,
  onRestart,
}: {
  services: ServiceInfo[] | undefined;
  loading: boolean;
  error: string | null;
  stale: boolean;
  restarting: ManagedService | null;
  /** Shown to Operators and above. */
  onRestart?: (service: ManagedService, name: string) => void;
}): React.JSX.Element {
  const shown = (services ?? []).filter((service) => service.state !== 'notInstalled');
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" /> Services
        </CardTitle>
        <CardDescription>What systemd says about the services the server runs.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : !services ? (
          <p role="alert" className="text-sm text-muted-foreground">
            The services did not load{error ? `: ${error}` : '.'}
          </p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No services to show.</p>
        ) : (
          <ul aria-label="Services" className={cn('transition-opacity', stale && 'opacity-50')}>
            {shown.map((service) => {
              const managed = managedService(service);
              const busy = managed !== null && restarting === managed;
              return (
                <li
                  key={service.unit}
                  aria-label={service.name}
                  className="flex items-center gap-3 border-t border-border/60 py-2 first:border-t-0"
                >
                  <StateMark state={service.state} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{service.name}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {service.unit}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      service.state === 'failed'
                        ? 'font-medium text-destructive'
                        : 'text-muted-foreground',
                    )}
                  >
                    {STATE_TEXT[service.state]}
                  </span>
                  {onRestart && managed && service.canRestart && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={restarting !== null}
                      onClick={() => onRestart(managed, service.name)}
                      aria-label={`Restart ${service.name}`}
                    >
                      {busy ? (
                        <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5" />
                      )}
                      Restart
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
