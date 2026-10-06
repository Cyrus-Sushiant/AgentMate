import type { DeployWordPressSite } from '@shared/deployWordPressTypes';
import { Badge } from '@/components/ui/badge';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { WordPressMark } from '@/components/wordpress/WordPressMark';
import { lastSeenText, SCOPE_SUMMARY } from './messages';

/** A site's name, address and the two facts that change what can be done with it. */
export function SiteHeader({ site }: { site: DeployWordPressSite }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#21759b]/15">
        <WordPressMark className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-foreground">{site.label}</h2>
        <p className="truncate font-mono text-xs text-muted-foreground">{site.siteUrl}</p>
      </div>
      {site.scope === 'read' && (
        <SimpleTooltip label={SCOPE_SUMMARY.read}>
          <Badge variant="secondary" tabIndex={0}>
            Read-only
          </Badge>
        </SimpleTooltip>
      )}
      {site.transport === 'plain-http' && (
        <SimpleTooltip label="Calls are signed but not encrypted, so the files can be read on the network.">
          <Badge variant="warning" tabIndex={0}>
            Plain HTTP
          </Badge>
        </SimpleTooltip>
      )}
      <span className="ml-auto text-xs text-muted-foreground">{lastSeenText(site)}</span>
    </div>
  );
}
