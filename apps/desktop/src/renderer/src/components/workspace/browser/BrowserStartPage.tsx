import { Clock, Globe, MessageSquarePlus, Server } from '@/components/icons';
import { displayUrl, normalizeAddress } from '@/lib/browser/address';
import type { DetectedServer } from '@/stores/devServerStore';
import { useShortcutLabel } from '@/stores/shortcutStore';

/**
 * What a new browser tab shows before it has a page: an address field, the dev servers the
 * workspace's terminals printed, and the addresses opened lately.
 */

export function ServerButton({
  server,
  onOpen,
}: {
  server: DetectedServer;
  onOpen: (url: string) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onOpen(server.url)}
      className="group flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-xs text-foreground">
          {displayUrl(server.url)}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {server.terminalTitle}
        </span>
      </span>
      <span className="text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Open
      </span>
    </button>
  );
}

export function BrowserStartPage({
  servers,
  recent,
  onOpen,
}: {
  servers: readonly DetectedServer[];
  recent: readonly string[];
  onOpen: (url: string) => void;
}): React.JSX.Element {
  const offered = new Set(servers.map((server) => server.url));
  const pickKey = useShortcutLabel('workspace.pickElement');
  const others = recent.filter((url) => !offered.has(url)).slice(0, 5);

  return (
    <div className="flex h-full w-full justify-center overflow-y-auto px-6 py-10">
      <div className="flex w-full max-w-md flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-1">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary shadow-[0_0_24px_-8px_hsl(var(--primary)/0.8)]">
            <Globe className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Open a page</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Then pick any element on it to leave a comment for your agent.
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem('address') as HTMLInputElement;
            const url = normalizeAddress(input.value);
            if (url) onOpen(url);
          }}
        >
          <input
            name="address"
            aria-label="Open a page"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="localhost:3000, a site, or a search"
            className="h-10 w-full rounded-xl border border-border bg-background/70 px-4 text-sm shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)] outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/20 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        </form>

        {servers.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Server className="h-3 w-3" />
              Running in this workspace
            </h3>
            {servers.map((server) => (
              <ServerButton key={server.url} server={server} onOpen={onOpen} />
            ))}
          </section>
        ) : (
          <p className="rounded-lg border border-dashed border-border/70 px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground">
            Start your dev server in a terminal of this workspace and its address shows up here.
          </p>
        )}

        {others.length > 0 ? (
          <section className="flex flex-col gap-1">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3 w-3" />
              Recent
            </h3>
            {others.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => onOpen(url)}
                className="truncate rounded-md px-2 py-1.5 text-left font-mono text-xs text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {displayUrl(url)}
              </button>
            ))}
          </section>
        ) : null}

        {pickKey ? (
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80">
            <MessageSquarePlus className="h-3 w-3" />
            Comment on an element with
            <kbd className="rounded border border-border/80 bg-foreground/[0.04] px-1 font-mono text-[10px]">
              {pickKey}
            </kbd>
          </p>
        ) : null}
      </div>
    </div>
  );
}
