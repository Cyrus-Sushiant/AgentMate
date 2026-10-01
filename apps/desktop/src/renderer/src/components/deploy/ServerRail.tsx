import type { DeployServer } from '@shared/deployTypes';
import { Link } from 'react-router-dom';
import { CloudflareMark } from '@/components/cloudflare/CloudflareMark';
import { ExternalLink, Spinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDeploySetupStore } from '@/stores/deploySetupStore';
import { type ServerState, serverState, useCoreHealth } from './coreHealth';

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

/** Every saved server with how its core is doing, so the one that needs a look stands out. */
export function ServerRail({
  servers,
  selectedId,
  onSelect,
}: {
  servers: DeployServer[];
  selectedId: string | null;
  onSelect: (serverId: string) => void;
}): React.JSX.Element {
  return (
    <nav aria-label="Servers" className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Servers</p>
        <span className="text-xs tabular-nums text-muted-foreground">{servers.length}</span>
      </div>
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
    </nav>
  );
}
