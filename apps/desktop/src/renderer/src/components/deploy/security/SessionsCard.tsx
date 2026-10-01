import { coreErrorMessage } from '@shared/coreErrors';
import type { SessionInfo } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import type { DeployServer } from '@shared/deployTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, RefreshCw } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import { confirmDialog } from '@/stores/confirmStore';
import { SetupFailure } from '../SetupFailure';
import { ago, fromNow } from './format';

/**
 * The signed-in user's own sessions on a core, one per sign-in on any of their computers, this
 * one marked. Ending one signs that computer out at once; this one ends with Sign out instead.
 */
export function SessionsCard({ server }: { server: DeployServer }): React.JSX.Element {
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: queryKeys.deploySessions(server.id),
    queryFn: () => window.agentmat.deploySecurity.listSessions(server.id),
    retry: false,
  });

  async function end(work: () => Promise<string>): Promise<void> {
    try {
      toast.success(await work());
    } catch (error) {
      toast.error(coreErrorMessage(error));
    } finally {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deploySecurity(server.id) });
    }
  }

  async function endOne(session: SessionInfo): Promise<void> {
    const confirmed = await confirmDialog({
      title: `End the session on ${session.deviceName}?`,
      description: `${session.deviceName} is signed out of the core and asks for your password the next time it is used.`,
      confirmLabel: 'End the session',
      variant: 'destructive',
    });
    if (!confirmed) return;
    await end(async () => {
      await window.agentmat.deploySecurity.revokeSession(server.id, session.id);
      return `${session.deviceName} is signed out.`;
    });
  }

  async function endOthers(): Promise<void> {
    const confirmed = await confirmDialog({
      title: 'End all your other sessions?',
      description:
        'Every computer of yours but this one is signed out of the core and asks for your password the next time it is used.',
      confirmLabel: 'End them',
      variant: 'destructive',
      typeToConfirm: server.nickname,
    });
    if (!confirmed) return;
    await end(async () => {
      const count = await window.agentmat.deploySecurity.revokeOtherSessions(server.id);
      return `Ended ${count} other ${count === 1 ? 'session' : 'sessions'}.`;
    });
  }

  let body: React.ReactNode;
  if (sessions.isPending) {
    body = (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  } else if (sessions.isError) {
    body = (
      <div className="space-y-3">
        <SetupFailure message={coreErrorMessage(sessions.error)} />
        <Button size="sm" variant="outline" onClick={() => void sessions.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  } else {
    const others = sessions.data.filter((session) => !session.current);
    body = (
      <div className="space-y-3">
        <ul
          aria-label="Sessions"
          className="divide-y divide-border/60 rounded-lg border border-border/70 bg-secondary/20"
        >
          {sessions.data.map((session) => (
            <li
              key={session.id}
              aria-label={session.deviceName}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {session.deviceName}
                  </span>
                  {session.current && <Badge variant="outline">This session</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {[
                    `Signed in ${ago(session.createdAtUnixMs)}`,
                    `Active ${ago(session.lastRenewedAtUnixMs)}`,
                    `Ends ${fromNow(session.expiresAtUnixMs)}`,
                  ].join(' · ')}
                </p>
              </div>
              {!session.current && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  aria-label={`End the session on ${session.deviceName}`}
                  onClick={() => void endOne(session)}
                >
                  End
                </Button>
              )}
            </li>
          ))}
        </ul>
        {others.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => void endOthers()}>
            End all other sessions
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Your sessions
        </CardTitle>
        <CardDescription>
          Each time you signed in to this core, on any of your computers. A session lasts up to 180
          days, or 30 without use.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
