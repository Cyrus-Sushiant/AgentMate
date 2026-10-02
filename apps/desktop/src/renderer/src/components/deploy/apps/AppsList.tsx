import type { StackInfo } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { Blocks, FileCode, Plus, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { STATUS_TEXT, STATUS_TONE } from '@/lib/deploy/apps/format';
import { StatusPill } from './StatusPill';

/** The apps on a server, as cards: what each runs, how it is doing and where it came from. */

export const OPERATOR_ONLY = 'Deploying and changing apps needs the Operator role or higher.';

function AppCardSkeleton(): React.JSX.Element {
  return (
    <Card className="glass" aria-busy="true">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-24" />
      </CardContent>
    </Card>
  );
}

function NewAppButton({
  canOperate,
  onNew,
}: {
  canOperate: boolean;
  onNew: () => void;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={canOperate ? null : OPERATOR_ONLY} wrapTrigger>
      <Button size="sm" onClick={onNew} disabled={!canOperate}>
        <Plus className="h-3.5 w-3.5" /> New app
      </Button>
    </SimpleTooltip>
  );
}

function AppCard({ app, onOpen }: { app: StackInfo; onOpen: () => void }): React.JSX.Element {
  const source = app.source;
  return (
    <li aria-label={app.name}>
      <button
        type="button"
        onClick={onOpen}
        className="glass group flex h-full w-full flex-col gap-2 rounded-xl border border-border p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-foreground">
            {app.name}
          </span>
          <StatusPill tone={STATUS_TONE[app.status]}>{STATUS_TEXT[app.status]}</StatusPill>
        </span>
        {source?.projectName || source?.composePath ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <FileCode className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {[source.projectName, source.composePath].filter(Boolean).join(' / ')}
            </span>
          </span>
        ) : null}
        <span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {app.liveRevision !== undefined ? `Revision ${app.liveRevision} live` : 'Nothing live'}
          </span>
          <span>
            {app.containers === 0
              ? 'No containers'
              : `${app.runningContainers} of ${app.containers} containers running`}
          </span>
        </span>
      </button>
    </li>
  );
}

export function AppsList({
  apps,
  loading,
  error,
  canOperate,
  onRetry,
  onOpen,
  onNew,
}: {
  apps: StackInfo[] | undefined;
  loading: boolean;
  error: string | null;
  canOperate: boolean;
  onRetry: () => void;
  onOpen: (stackId: string) => void;
  onNew: () => void;
}): React.JSX.Element {
  return (
    <section aria-labelledby="apps-heading" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 id="apps-heading" className="text-base font-semibold text-foreground">
            Apps
          </h3>
          <p className="text-xs text-muted-foreground">
            Compose apps from your projects. Their ports stay on this server; public access comes
            through Websites.
          </p>
        </div>
        {apps && apps.length > 0 && <NewAppButton canOperate={canOperate} onNew={onNew} />}
      </div>
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <AppCardSkeleton key={index} />
          ))}
        </div>
      ) : !apps ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"
        >
          <span className="min-w-0 flex-1 text-foreground">
            The apps did not load{error ? `: ${error}` : '.'}
          </span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Blocks className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No apps on this server yet</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Pick a project with a compose file and one of its environments. Every deploy is kept
              as a revision you can roll back to.
            </p>
          </div>
          <NewAppButton canOperate={canOperate} onNew={onNew} />
        </div>
      ) : (
        <ul aria-label="Apps" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} onOpen={() => onOpen(app.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}
