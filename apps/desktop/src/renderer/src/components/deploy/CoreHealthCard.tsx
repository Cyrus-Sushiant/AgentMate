import type { DeployCoreRecord, DeployServer } from '@shared/deployTypes';
import { sshErrorMessage } from '@shared/sshErrors';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { EllipsisVertical, RefreshCw, Rocket, Trash2 } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { formatUptime } from '@/lib/deploy/setup';
import { queryKeys } from '@/lib/queryKeys';
import { withHostKeyTrust } from '@/lib/ssh/hostKeyTrust';
import { shortAge, timeAgo } from '@/lib/time';
import { TRANSPORT_PHRASE, TRANSPORT_TEXT, useCoreHealth } from './coreHealth';
import { SetupFailure } from './SetupFailure';

function Fact({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-0.5 truncate text-sm font-medium text-foreground ${mono ? 'font-mono' : ''}`}
      >
        {children}
      </dd>
    </div>
  );
}

/** Re-renders every so often so "up for" and "checked" stay true between checks. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** A live look at a server's core: whether it answers, its version and how long it has run. */
export function CoreHealthCard({
  server,
  core,
  onReinstall,
  onRemove,
}: {
  server: DeployServer;
  core: DeployCoreRecord;
  onReinstall?: () => void;
  onRemove?: (keepData: boolean) => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const health = useCoreHealth(server);
  const now = useNow(15_000);
  const [checking, setChecking] = useState(false);

  async function checkNow(): Promise<void> {
    setChecking(true);
    try {
      await queryClient.fetchQuery({
        queryKey: queryKeys.deployHealth(server.id),
        queryFn: () => withHostKeyTrust(server.id, () => window.agentmat.deploy.health(server.id)),
        staleTime: 0,
      });
    } catch {
      // The card shows the failure from the query itself.
    } finally {
      setChecking(false);
    }
  }

  const answering = health.isSuccess && !health.isError;
  const status = health.isError ? (
    <Badge variant="warning">Not answering</Badge>
  ) : answering ? (
    <Badge variant="success" className="gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      Online
    </Badge>
  ) : (
    <Badge variant="secondary">Connecting…</Badge>
  );

  return (
    <Card className="glass">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" /> Server core
          </CardTitle>
          <CardDescription>
            {health.isError
              ? 'The last check did not get an answer.'
              : health.data
                ? `Answering through ${TRANSPORT_PHRASE[core.transport]}, checked ${shortAge(health.data.checkedAt, now)} ago.`
                : 'Checking whether the core answers.'}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {status}
          <SimpleTooltip label="Check now">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Check now"
              disabled={checking}
              onClick={() => void checkNow()}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'motion-safe:animate-spin' : ''}`} />
            </Button>
          </SimpleTooltip>
          {(onReinstall || onRemove) && (
            <DropdownMenu>
              <SimpleTooltip label="More actions">
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="More actions">
                    <EllipsisVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
              </SimpleTooltip>
              <DropdownMenuContent align="end">
                {onReinstall && (
                  <DropdownMenuItem onSelect={onReinstall}>
                    <Rocket className="h-3.5 w-3.5" /> Update or reinstall
                  </DropdownMenuItem>
                )}
                {onRemove && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onRemove(true)}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove the core, keep its data
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => onRemove(false)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove the core and its data
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {health.isError && (
          <div className="space-y-2">
            <SetupFailure message={sshErrorMessage(health.error)} />
            <p className="text-xs text-muted-foreground">
              If the server just restarted, the core starts with it and answers again shortly.
            </p>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <Fact label="Version" mono>
            {health.data ? (
              health.data.version
            ) : health.isPending ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              core.version
            )}
          </Fact>
          <Fact label="Up for">
            {health.data ? (
              formatUptime(health.data.startedAtUnixMs, now)
            ) : health.isPending ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              'Unknown'
            )}
          </Fact>
          <Fact label="Installed">
            {server.dev ? 'From your checkout' : timeAgo(new Date(core.installedAt).toISOString())}
          </Fact>
          <Fact label="Operating system">{core.os}</Fact>
          <Fact label="Processor" mono>
            {core.architecture}
          </Fact>
          <Fact label="Connection">{TRANSPORT_TEXT[core.transport]}</Fact>
        </dl>
      </CardContent>
    </Card>
  );
}
