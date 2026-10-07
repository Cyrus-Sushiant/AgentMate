import { RotateCw, TriangleAlert } from '@/components/icons';
import { SECTION_HEADING } from '@/components/pageKit';
import { Button } from '@/components/ui/button';
import { isLocalUrl } from '@/lib/browser/address';
import type { BrowserNavState } from '@/lib/browser/browserRuntime';
import { cn } from '@/lib/utils';
import type { DetectedServer } from '@/stores/devServerStore';
import { ServerButton } from './BrowserStartPage';

/** Shown over a browser tab whose page failed to load, in place of Chromium's own error page. */

/** net::ERR_CONNECTION_REFUSED: nothing is listening on that port. */
const CONNECTION_REFUSED = -102;

function portOf(url: string): string | null {
  try {
    return new URL(url).port || null;
  } catch {
    return null;
  }
}

export function BrowserError({
  error,
  servers,
  onRetry,
  onOpen,
}: {
  error: NonNullable<BrowserNavState['error']>;
  servers: readonly DetectedServer[];
  onRetry: () => void;
  onOpen: (url: string) => void;
}): React.JSX.Element {
  const port = portOf(error.url);
  const devServerDown = error.code === CONNECTION_REFUSED && isLocalUrl(error.url) && port;
  const others = servers.filter((server) => server.url !== error.url);

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center overflow-y-auto bg-background px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center animate-in fade-in-0">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/12 text-warning shadow-[0_0_40px_-12px_hsl(var(--warning)/0.7)]">
          <TriangleAlert className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {devServerDown
              ? `Nothing is listening on port ${port}`
              : 'This page could not be loaded'}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {devServerDown ? (
              'Is the dev server running? Start it in a terminal, then try again.'
            ) : (
              <span className="font-mono text-[11px]">{error.description}</span>
            )}
          </p>
          <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground/70">
            {error.url}
          </p>
        </div>
        <Button size="sm" onClick={onRetry}>
          <RotateCw />
          Try again
        </Button>
        {devServerDown && others.length > 0 ? (
          <div className="flex w-full flex-col gap-2 pt-2 text-left">
            <p className={cn(SECTION_HEADING, 'px-1')}>Running in this workspace</p>
            {others.map((server) => (
              <ServerButton key={server.url} server={server} onOpen={onOpen} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
