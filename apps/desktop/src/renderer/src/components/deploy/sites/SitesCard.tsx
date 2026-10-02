import type { SiteInfo } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { CircleCheck, Clock, Globe, Pencil, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SiteTab } from '@/lib/deploy/sites/problems';
import { RouteMap } from './RouteMap';

/** Every site on the server as its route, whether it is live, and a way into its editor. */

export function SitesCard({
  sites,
  loading,
  error,
  admin,
  managed,
  onOpen,
  onAdd,
}: {
  sites: SiteInfo[] | undefined;
  loading: boolean;
  error: string | null;
  admin: boolean;
  /** Sites can be added once AgentMate looks after nginx. */
  managed: boolean;
  onOpen: (siteId: string, tab: SiteTab) => void;
  onAdd: () => void;
}): React.JSX.Element {
  const now = Date.now();
  return (
    <Card className="glass">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" /> Websites
          </CardTitle>
          <CardDescription>Domains nginx serves, and where each one leads.</CardDescription>
        </div>
        {admin && managed && (
          <Button type="button" size="sm" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" /> Add a site
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : !sites || sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {managed
              ? 'No sites yet. Add one to put an app on a domain.'
              : 'Set up nginx above, then add a site.'}
          </p>
        ) : (
          <ul aria-label="Sites" className="divide-y divide-border/60">
            {sites.map((site) => {
              const domain = site.settings.domains[0] ?? site.settings.id;
              return (
                <li
                  key={site.settings.id}
                  aria-label={domain}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <RouteMap
                      site={site}
                      now={now}
                      onOpen={(tab) => onOpen(site.settings.id, tab)}
                    />
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {site.applied ? (
                      <>
                        <CircleCheck className="h-3 w-3 text-success" /> Live
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 text-warning" /> Not applied yet
                      </>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${domain}`}
                    onClick={() => onOpen(site.settings.id, 'domains')}
                  >
                    <Pencil className="h-3.5 w-3.5" /> {admin ? 'Edit' : 'View'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
