import type { DeployWordPressSite } from '@shared/deployWordPressTypes';
import { Chip, GLASS_CARD } from '@/components/pageKit';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { WordPressMark } from '@/components/wordpress/WordPressMark';
import { cn } from '@/lib/utils';
import { lastSeenText, SCOPE_SUMMARY } from './messages';

/** A site's name, address and the two facts that change what can be done with it. */
export function SiteHeader({ site }: { site: DeployWordPressSite }): React.JSX.Element {
  return (
    <div className={cn(GLASS_CARD, 'flex shrink-0 flex-wrap items-center gap-3 px-4 py-3')}>
      {/* A neutral tile, since the mark brings WordPress's own blue. */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06]">
        <WordPressMark className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold leading-tight tracking-tight text-foreground">
          {site.label}
        </h2>
        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{site.siteUrl}</p>
      </div>
      {site.scope === 'read' && (
        <SimpleTooltip label={SCOPE_SUMMARY.read}>
          <Chip tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Read-only
          </Chip>
        </SimpleTooltip>
      )}
      {site.transport === 'plain-http' && (
        <SimpleTooltip label="Calls are signed but not encrypted, so the files can be read on the network.">
          <Chip
            tone="warning"
            tabIndex={0}
            className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Plain HTTP
          </Chip>
        </SimpleTooltip>
      )}
      <span className="ml-auto text-xs text-muted-foreground">{lastSeenText(site)}</span>
    </div>
  );
}
