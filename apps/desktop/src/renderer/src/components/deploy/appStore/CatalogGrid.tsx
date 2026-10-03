import type { AnyCatalogTemplate } from '@agentmat/core';
import { useMemo, useState } from 'react';
import { CircleCheck, Search, Store } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleTooltip } from '@/components/ui/tooltip';
import {
  allOfficial,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  memoryText,
} from '@/lib/deploy/appStore/format';

/**
 * The catalog, by category: what each app is, who publishes its images and what it needs, with
 * a filter by name. Every card opens the same install sheet.
 */

function AppCard({
  template,
  canInstall,
  onInstall,
}: {
  template: AnyCatalogTemplate;
  canInstall: boolean;
  onInstall: (templateId: string) => void;
}): React.JSX.Element {
  const version = template.versions.find((item) => item.id === template.defaultVersion);
  const official = version ? allOfficial(version) : false;
  const install = (
    <Button
      size="sm"
      variant="outline"
      disabled={!canInstall}
      onClick={() => onInstall(template.id)}
      aria-label={`Install ${template.name}`}
    >
      Install
    </Button>
  );
  return (
    <li
      aria-label={template.name}
      className="glass flex flex-col gap-2 rounded-xl border border-border/60 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-foreground">{template.name}</h4>
          <p className="text-xs text-muted-foreground">{version?.label}</p>
        </div>
        {canInstall ? (
          install
        ) : (
          <SimpleTooltip label="Installing apps needs the Operator role or higher." wrapTrigger>
            {install}
          </SimpleTooltip>
        )}
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
      <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CircleCheck className="h-3 w-3 text-success" />
          {official ? 'Official image' : 'Verified publisher'}
        </span>
        <span>Needs {memoryText(template.minMemoryMb)}</span>
      </p>
    </li>
  );
}

export function CatalogGrid({
  templates,
  canInstall,
  onInstall,
}: {
  templates: readonly AnyCatalogTemplate[];
  canInstall: boolean;
  onInstall: (templateId: string) => void;
}): React.JSX.Element {
  const [filter, setFilter] = useState('');
  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const shown = templates.filter(
      (template) =>
        needle === '' ||
        template.name.toLowerCase().includes(needle) ||
        template.description.toLowerCase().includes(needle),
    );
    return CATEGORY_ORDER.map((category) => ({
      category,
      templates: shown.filter((template) => template.category === category),
    })).filter((group) => group.templates.length > 0);
  }, [templates, filter]);

  return (
    <section aria-label="Catalog" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Store className="h-4 w-4 text-muted-foreground" /> Catalog
        </h3>
        <div className="relative w-64 max-w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Find an app"
            placeholder="Find an app"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-8 pl-8"
          />
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No app matches {JSON.stringify(filter)}.</p>
      ) : (
        groups.map((group) => (
          <div key={group.category} className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABEL[group.category]}
            </h4>
            <ul
              aria-label={CATEGORY_LABEL[group.category]}
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              {group.templates.map((template) => (
                <AppCard
                  key={template.id}
                  template={template}
                  canInstall={canInstall}
                  onInstall={onInstall}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
