import type { DeployWordPressSite } from '@shared/deployWordPressTypes';
import { FileText, RefreshCw, Spinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SetupFailure } from '../SetupFailure';
import { useSiteAudit } from './hooks';
import { AUDIT_EVENT_LABEL, AUDIT_EVENT_WARNS, siteTimeText, wpProblem } from './messages';

/**
 * The site's own audit log: key creation, connections, refused requests, pulls, deploys and
 * rollbacks, newest first, a page at a time. The same log shows in wp-admin. Every field comes
 * from the site, so it is shown as text only.
 */
export function AuditLogList({ site }: { site: DeployWordPressSite }): React.JSX.Element {
  const audit = useSiteAudit(site.id);
  const entries = audit.data?.pages.flat() ?? [];

  let body: React.ReactNode;
  if (audit.isPending) {
    body = (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full rounded-md" />
        ))}
      </div>
    );
  } else if (audit.isError) {
    body = (
      <div className="space-y-3">
        <SetupFailure message={wpProblem(audit.error)} />
        <Button size="sm" variant="outline" onClick={() => void audit.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  } else if (entries.length === 0) {
    body = <p className="text-sm text-muted-foreground">Nothing has been recorded yet.</p>;
  } else {
    body = (
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
            <caption className="sr-only">Audit log, newest first</caption>
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  When
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  What
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Connection
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  From
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {siteTimeText(entry.at)}
                  </td>
                  <td className="max-w-[20rem] px-3 py-2">
                    <span
                      className={cn(
                        'block font-medium',
                        AUDIT_EVENT_WARNS.has(entry.event) ? 'text-warning' : 'text-foreground',
                      )}
                    >
                      {AUDIT_EVENT_LABEL[entry.event] ?? entry.event}
                    </span>
                    {entry.detail && (
                      <SimpleTooltip label={entry.detail}>
                        <span className="block truncate text-muted-foreground">{entry.detail}</span>
                      </SimpleTooltip>
                    )}
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-2 text-foreground">
                    {entry.connectionLabel ?? 'None'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">
                    {entry.ip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {audit.hasNextPage && (
          <Button
            size="sm"
            variant="outline"
            disabled={audit.isFetchingNextPage}
            onClick={() => void audit.fetchNextPage()}
          >
            {audit.isFetchingNextPage && (
              <Spinner className="h-3.5 w-3.5 motion-safe:animate-spin" />
            )}
            Load older entries
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Audit log
          </CardTitle>
          <CardDescription className="max-w-2xl">
            What the connector recorded on the site, newest first: keys, connections, refused
            requests, pulls, deploys and rollbacks. wp-admin shows the same log under Tools &gt;
            AgentMate Connector.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={audit.isFetching}
          onClick={() => void audit.refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
