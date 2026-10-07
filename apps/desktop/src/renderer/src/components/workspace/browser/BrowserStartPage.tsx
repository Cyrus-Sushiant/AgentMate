import { Clock, Globe, MessageSquarePlus, Server } from '@/components/icons';
import { Chip, GLASS_CARD, Notice, SECTION_HEADING } from '@/components/pageKit';
import { displayUrl, normalizeAddress } from '@/lib/browser/address';
import { cn } from '@/lib/utils';
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
      // A glass row with an inset ring for its hover edge, since a tinted border would lose to
      // the global border colour.
      className={cn(
        GLASS_CARD,
        'group flex w-full items-center gap-3 px-3 py-2.5 text-left ring-1 ring-inset ring-transparent transition-shadow hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
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
      <Chip
        tone="primary"
        className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        Open
      </Chip>
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
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_40px_-12px_hsl(var(--primary)/0.7)]">
            <Globe className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Open a page</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
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
            className="field-surface h-10 w-full rounded-full px-4 text-sm outline-none"
          />
        </form>

        {servers.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className={cn(SECTION_HEADING, 'flex items-center gap-1.5 px-1')}>
              <Server className="h-3 w-3" />
              Running in this workspace
            </h3>
            {servers.map((server) => (
              <ServerButton key={server.url} server={server} onOpen={onOpen} />
            ))}
          </section>
        ) : (
          <Notice size="sm" icon={Server} className="text-muted-foreground">
            Start your dev server in a terminal of this workspace and its address shows up here.
          </Notice>
        )}

        {others.length > 0 ? (
          <section className="flex flex-col gap-1">
            <h3 className={cn(SECTION_HEADING, 'flex items-center gap-1.5 px-1 pb-0.5')}>
              <Clock className="h-3 w-3" />
              Recent
            </h3>
            {others.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => onOpen(url)}
                className="truncate rounded-lg px-2.5 py-1.5 text-left font-mono text-xs text-foreground/80 transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <kbd className="rounded-full bg-foreground/[0.07] px-2 py-0.5 font-sans text-[10px] font-medium">
              {pickKey}
            </kbd>
          </p>
        ) : null}
      </div>
    </div>
  );
}
