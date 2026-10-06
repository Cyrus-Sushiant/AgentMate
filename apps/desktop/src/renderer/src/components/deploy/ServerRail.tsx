import type { DeployServer } from '@shared/deployTypes';
import type { DeployWordPressSite } from '@shared/deployWordPressTypes';
import { Link } from 'react-router-dom';
import { CloudflareMark } from '@/components/cloudflare/CloudflareMark';
import { ExternalLink, Plus, RefreshCw, Spinner } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WordPressMark } from '@/components/wordpress/WordPressMark';
import { cn } from '@/lib/utils';
import { useDeploySetupStore } from '@/stores/deploySetupStore';
import { type ServerState, serverState, useCoreHealth } from './coreHealth';
import { lastSeenText, siteHost } from './wordpress/messages';

function StatusDot({ state }: { state: ServerState }): React.JSX.Element {
  if (state === 'busy' || state === 'connecting') {
    return (
      <Spinner
        className={cn(
          'h-3 w-3 motion-safe:animate-spin',
          state === 'busy' ? 'text-primary' : 'text-muted-foreground',
        )}
      />
    );
  }
  if (state === 'online') {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-50 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
      </span>
    );
  }
  if (state === 'offline') return <span className="h-2.5 w-2.5 rounded-full bg-warning" />;
  return <span className="h-2.5 w-2.5 rounded-full border-2 border-muted-foreground/50" />;
}

function RailItem({
  server,
  selected,
  onSelect,
}: {
  server: DeployServer;
  selected: boolean;
  onSelect: (serverId: string) => void;
}): React.JSX.Element {
  const health = useCoreHealth(server);
  const run = useDeploySetupStore((state) => state.runs[server.id]);
  const state = serverState(server, health, run);
  const text: Record<ServerState, string> = {
    'not-installed': 'Core not installed',
    busy: run?.kind === 'uninstall' ? 'Removing the core…' : 'Installing the core…',
    connecting: 'Connecting…',
    online: `Online, core ${health.data?.version ?? ''}`.trim(),
    offline: 'Not answering',
  };

  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(server.id)}
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected
            ? 'border-primary/40 bg-primary/10'
            : 'border-border bg-secondary/30 hover:bg-accent',
        )}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <StatusDot state={state} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {server.nickname}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{text[state]}</span>
        </span>
      </button>
    </li>
  );
}

function SiteRailItem({
  site,
  selected,
  onSelect,
}: {
  site: DeployWordPressSite;
  selected: boolean;
  onSelect: (siteId: string) => void;
}): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(site.id)}
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected
            ? 'border-primary/40 bg-primary/10'
            : 'border-border bg-secondary/30 hover:bg-accent',
        )}
      >
        <WordPressMark className="h-4 w-4" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{site.label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {siteHost(site.siteUrl)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-muted-foreground">{lastSeenText(site)}</span>
            {site.scope === 'read' && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                Read-only
              </Badge>
            )}
            {site.transport === 'plain-http' && (
              <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                Plain HTTP
              </Badge>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/** The WordPress sites group under the servers, with its own loading and failure states. */
function SiteGroup({
  sites,
  loading,
  error,
  selectedSiteId,
  onSelectSite,
  onRetrySites,
  onConnectSite,
}: {
  sites: DeployWordPressSite[];
  loading: boolean;
  error: string | null;
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
  onRetrySites?: () => void;
  onConnectSite?: () => void;
}): React.JSX.Element {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          WordPress sites
        </p>
        {!loading && !error && (
          <span className="text-xs tabular-nums text-muted-foreground">{sites.length}</span>
        )}
      </div>
      {loading ? (
        <div className="flex flex-col gap-1.5" aria-busy="true">
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : error ? (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 p-2.5">
          <p className="text-xs text-foreground">The WordPress sites did not load: {error}</p>
          {onRetrySites && (
            <Button size="sm" variant="outline" onClick={onRetrySites}>
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          )}
        </div>
      ) : (
        sites.length > 0 && (
          <ul aria-label="WordPress sites" className="flex flex-col gap-1.5">
            {sites.map((site) => (
              <SiteRailItem
                key={site.id}
                site={site}
                selected={site.id === selectedSiteId}
                onSelect={onSelectSite}
              />
            ))}
          </ul>
        )
      )}
      {onConnectSite && (
        <Button variant="outline" size="sm" className="justify-start" onClick={onConnectSite}>
          <Plus className="h-3.5 w-3.5" /> Connect a WordPress site
        </Button>
      )}
    </div>
  );
}

/**
 * Every saved server with how its core is doing, so the one that needs a look stands out, and
 * under them the WordPress sites connected through the AgentMate Connector plugin.
 */
export function ServerRail({
  servers,
  selectedId,
  onSelect,
  sites,
  sitesLoading = false,
  sitesError = null,
  selectedSiteId = null,
  onSelectSite,
  onRetrySites,
  onConnectSite,
}: {
  servers: DeployServer[];
  selectedId: string | null;
  onSelect: (serverId: string) => void;
  /** Left out, the WordPress group is not shown at all. */
  sites?: DeployWordPressSite[];
  sitesLoading?: boolean;
  sitesError?: string | null;
  selectedSiteId?: string | null;
  onSelectSite?: (siteId: string) => void;
  onRetrySites?: () => void;
  onConnectSite?: () => void;
}): React.JSX.Element {
  return (
    <nav aria-label="Servers" className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Servers</p>
        <span className="text-xs tabular-nums text-muted-foreground">{servers.length}</span>
      </div>
      {servers.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">No servers yet.</p>
      )}
      <ul className="flex flex-col gap-1.5">
        {servers.map((server) => (
          <RailItem
            key={server.id}
            server={server}
            selected={server.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <Button asChild variant="ghost" size="sm" className="justify-start text-muted-foreground">
        <Link to="/remote">
          <ExternalLink className="h-3.5 w-3.5" /> Add or edit servers in Remote
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm" className="justify-start">
        <Link to="/deploy/cloudflare">
          <CloudflareMark className="h-3.5 w-3.5" /> Cloudflare: domains and DNS
        </Link>
      </Button>
      {(sites !== undefined || sitesLoading || sitesError !== null) && onSelectSite && (
        <SiteGroup
          sites={sites ?? []}
          loading={sitesLoading}
          error={sitesError}
          selectedSiteId={selectedSiteId}
          onSelectSite={onSelectSite}
          onRetrySites={onRetrySites}
          onConnectSite={onConnectSite}
        />
      )}
    </nav>
  );
}
