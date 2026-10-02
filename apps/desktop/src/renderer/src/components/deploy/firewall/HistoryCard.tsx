import type { FirewallChangeSetInfo } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { CircleCheck, CircleX, Clock, TriangleAlert, Undo } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { changeStateText } from '@/lib/deploy/firewall/format';
import { ago, dateTime } from '../security/format';

/**
 * Every change set, newest first: what it did, who made it from where, and how it ended (kept,
 * reverted, or rolled back by the timer because nobody kept it). Each one opens to the exact
 * commands it ran.
 */

function StateMark({ change }: { change: FirewallChangeSetInfo }) {
  if (change.state === 'confirmed') return <CircleCheck className="h-3.5 w-3.5 text-success" />;
  if (change.state === 'rolledBack') return <Undo className="h-3.5 w-3.5 text-warning" />;
  if (change.state === 'awaitingConfirmation' || change.state === 'applying') {
    return <Clock className="h-3.5 w-3.5 text-warning" />;
  }
  return <CircleX className="h-3.5 w-3.5 text-destructive" />;
}

export function HistoryCard({
  changes,
  loading,
  error,
  now,
}: {
  changes: FirewallChangeSetInfo[] | undefined;
  loading: boolean;
  error: string | null;
  now: number;
}): React.JSX.Element {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Change history</CardTitle>
        <CardDescription>What was applied, and whether it was kept.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && !changes ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error && !changes ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : !changes || changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No changes yet. Changes made here show up with how they ended.
          </p>
        ) : (
          <ul aria-label="Change history" className="divide-y divide-border/60">
            {changes.map((change) => (
              <li key={change.id} aria-label={change.summary} className="py-2">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="mt-0.5">
                      <StateMark change={change} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">
                        {change.summary}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {changeStateText(change)} · {ago(change.createdAtUnixMs, now)}
                        {change.requestedBy ? ` by ${change.requestedBy}` : ''}
                        {change.appliedFrom ? ` from ${change.appliedFrom}` : ''}
                      </span>
                    </span>
                    {change.guardOverridden && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-destructive/40 px-1.5 py-0.5 text-[11px] text-destructive">
                        <TriangleAlert className="h-3 w-3" /> SSH check overridden
                      </span>
                    )}
                  </summary>
                  <div className="mt-2 space-y-1 pl-6">
                    <p className="text-xs text-muted-foreground">
                      {dateTime(change.createdAtUnixMs)}
                      {change.error ? `. ${change.error}` : ''}
                    </p>
                    <pre className="overflow-auto rounded border border-border bg-muted/40 p-2 font-mono text-[11px] text-foreground">
                      {change.commands.join('\n')}
                    </pre>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
