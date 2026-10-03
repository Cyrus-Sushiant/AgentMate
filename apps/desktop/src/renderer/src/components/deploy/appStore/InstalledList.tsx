import { checkCatalogUpdate } from '@agentmat/core';
import { ChevronRight, RefreshCw } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_TEXT, STATUS_TONE } from '@/lib/deploy/apps/format';
import { StatusPill } from '../apps/StatusPill';
import type { InstalledStoreApp } from './hooks';

/** The apps this server got from the App Store, each with its status and any update waiting. */

export function InstalledList({
  apps,
  loading,
  onOpen,
}: {
  apps: InstalledStoreApp[];
  loading: boolean;
  onOpen: (stackId: string) => void;
}): React.JSX.Element | null {
  if (loading && apps.length === 0) {
    return <Skeleton className="h-16 w-full rounded-xl" aria-busy="true" />;
  }
  if (apps.length === 0) return null;
  return (
    <section aria-label="Installed from the App Store" className="space-y-2">
      <h3 className="text-base font-semibold">Installed</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {apps.map(({ stack, install }) => {
          const check = checkCatalogUpdate(install.template, install.installed);
          const waiting = check.status === 'update' || check.newerVersions.length > 0;
          const version = install.template.versions.find((item) => item.id === install.version);
          return (
            <li key={stack.id} aria-label={stack.name}>
              <button
                type="button"
                onClick={() => onOpen(stack.id)}
                className="glass flex w-full items-center gap-3 rounded-xl border border-border/60 px-3 py-2 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{stack.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {version?.label ?? `${install.template.name} ${install.version}`}
                    {install.domain ? ` on ${install.domain}` : ''}
                  </span>
                </span>
                {waiting && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    <RefreshCw className="h-3 w-3" /> Update available
                  </span>
                )}
                <StatusPill tone={STATUS_TONE[stack.status]}>
                  {STATUS_TEXT[stack.status]}
                </StatusPill>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
