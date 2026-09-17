import type { VaultEntrySummary, VaultSearchHit, VaultSort } from '@agentmat/core';
import { forwardRef } from 'react';
import {
  ChevronsUpDown,
  Download,
  EllipsisVertical,
  Key,
  Lock,
  Plus,
  Search,
  Star,
  Upload,
  Vault,
  X,
} from '@/components/icons';
import { ProjectEmptyState } from '@/components/projects/ProjectDetailChrome';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useShortcutLabel } from '@/stores/shortcutStore';
import { useVaultStore, type VaultTypeFilter } from '@/stores/vaultStore';
import { ENTRY_TYPE_META, ENTRY_TYPE_ORDER } from './entryTypes';
import type { useVaultActions } from './useVaultActions';
import { VaultEntryRow, vaultOptionId } from './VaultEntryRow';

export const VAULT_LISTBOX_ID = 'vault-entries';

const SORT_LABELS: Record<VaultSort, string> = {
  title: 'Title, A to Z',
  recent: 'Recently used',
  updated: 'Recently updated',
  created: 'Newest first',
};

export interface VaultListGroup {
  label: string | null;
  hits: VaultSearchHit[];
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
        pressed
          ? 'border-primary/50 bg-primary/15 text-foreground'
          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export const VaultListPane = forwardRef<
  HTMLInputElement,
  {
    entries: VaultEntrySummary[];
    groups: VaultListGroup[];
    visibleCount: number;
    searching: boolean;
    knownTags: string[];
    selectedId: string | null;
    actions: ReturnType<typeof useVaultActions>;
    onSelect: (id: string) => void;
    onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    onNew: (title?: string) => void;
    onImport: () => void;
    onExport: () => void;
    onChangePassword: () => void;
    className?: string;
  }
>(function VaultListPane(
  {
    entries,
    groups,
    visibleCount,
    searching,
    knownTags,
    selectedId,
    actions,
    onSelect,
    onSearchKeyDown,
    onNew,
    onImport,
    onExport,
    onChangePassword,
    className,
  },
  searchRef,
) {
  const query = useVaultStore((s) => s.query);
  const setQuery = useVaultStore((s) => s.setQuery);
  const typeFilter = useVaultStore((s) => s.typeFilter);
  const setTypeFilter = useVaultStore((s) => s.setTypeFilter);
  const tagFilters = useVaultStore((s) => s.tagFilters);
  const toggleTag = useVaultStore((s) => s.toggleTag);
  const favoritesOnly = useVaultStore((s) => s.favoritesOnly);
  const setFavoritesOnly = useVaultStore((s) => s.setFavoritesOnly);
  const clearFilters = useVaultStore((s) => s.clearFilters);
  const sort = useVaultStore((s) => s.sort);
  const setSort = useVaultStore((s) => s.setSort);
  const newShortcut = useShortcutLabel('vault.new');
  const lockShortcut = useShortcutLabel('vault.lock');
  const searchShortcut = useShortcutLabel('vault.search');

  const counts = new Map<VaultTypeFilter, number>([['all', entries.length]]);
  for (const entry of entries) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
  const hasFavorites = entries.some((entry) => entry.favorite);
  const filtered = typeFilter !== 'all' || tagFilters.length > 0 || favoritesOnly;
  const trimmed = query.trim();

  return (
    <aside className={cn('flex min-h-0 flex-col', className)}>
      <div className="space-y-3 border-b border-border/70 p-3">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              type="search"
              role="searchbox"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={`Search${searchShortcut ? ` (${searchShortcut})` : ''}`}
              aria-label="Search the vault"
              aria-controls={VAULT_LISTBOX_ID}
              autoComplete="off"
              spellCheck={false}
              className="h-8 pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setQuery('')}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <SimpleTooltip label={newShortcut ? `New entry (${newShortcut})` : 'New entry'}>
            <Button size="icon" className="h-8 w-8" aria-label="New entry" onClick={() => onNew()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </SimpleTooltip>
          <DropdownMenu>
            <SimpleTooltip label="More">
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="More vault actions"
                >
                  <EllipsisVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </SimpleTooltip>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={onImport}>
                <Upload className="h-3.5 w-3.5" />
                Import from CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExport} disabled={entries.length === 0}>
                <Download className="h-3.5 w-3.5" />
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onChangePassword}>
                <Key className="h-3.5 w-3.5" />
                Change master password
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SimpleTooltip label={lockShortcut ? `Lock vault (${lockShortcut})` : 'Lock vault'}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Lock vault"
              onClick={() => void actions.lock()}
            >
              <Lock className="h-3.5 w-3.5" />
            </Button>
          </SimpleTooltip>
        </div>

        {entries.length > 0 && (
          <>
            <div role="tablist" aria-label="Entry types" className="flex gap-1 overflow-x-auto">
              {(['all', ...ENTRY_TYPE_ORDER] as VaultTypeFilter[])
                .filter((type) => type === 'all' || (counts.get(type) ?? 0) > 0)
                .map((type) => {
                  const selected = typeFilter === type;
                  const label = type === 'all' ? 'All' : ENTRY_TYPE_META[type].plural;
                  return (
                    <button
                      key={type}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setTypeFilter(type)}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                        selected
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                      <span className="tabular-nums text-muted-foreground">
                        {counts.get(type) ?? 0}
                      </span>
                    </button>
                  );
                })}
            </div>

            {(hasFavorites || knownTags.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {hasFavorites && (
                  <Chip pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
                    <Star className="h-2.5 w-2.5 text-warning" />
                    Favorites
                  </Chip>
                )}
                {knownTags.map((tag) => (
                  <Chip key={tag} pressed={tagFilters.includes(tag)} onClick={() => toggleTag(tag)}>
                    {tag}
                  </Chip>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span aria-live="polite">
                {searching || filtered
                  ? `${visibleCount} ${visibleCount === 1 ? 'result' : 'results'}`
                  : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
                    aria-label={`Sort: ${SORT_LABELS[sort]}`}
                  >
                    {searching ? 'Best match' : SORT_LABELS[sort]}
                    <ChevronsUpDown className="h-2.5 w-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  {(Object.keys(SORT_LABELS) as VaultSort[]).map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option}
                      checked={sort === option}
                      onCheckedChange={() => setSort(option)}
                    >
                      {SORT_LABELS[option]}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <div className="p-2">
            <ProjectEmptyState
              icon={Vault}
              title="Your vault is empty"
              description="Add logins, API keys and private notes, or bring them over from your browser or another password manager."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => onNew()}>
                    <Plus className="h-3 w-3" />
                    Add your first entry
                  </Button>
                  <Button size="sm" variant="outline" onClick={onImport}>
                    <Upload className="h-3 w-3" />
                    Import from CSV
                  </Button>
                </div>
              }
            />
          </div>
        ) : visibleCount === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {trimmed ? `Nothing matches "${trimmed}"` : 'Nothing matches these filters'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {trimmed && (
                <Button size="sm" variant="outline" onClick={() => onNew(trimmed)}>
                  <Plus className="h-3 w-3" />
                  Create "{trimmed}"
                </Button>
              )}
              {filtered && (
                <Button size="sm" variant="ghost" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div
            id={VAULT_LISTBOX_ID}
            role="listbox"
            aria-label="Vault entries"
            aria-activedescendant={selectedId ? vaultOptionId(selectedId) : undefined}
            tabIndex={0}
            className="space-y-3 outline-none"
          >
            {groups.map((group) => (
              <div
                key={group.label ?? 'all'}
                role="group"
                aria-label={group.label ?? 'Entries'}
                className="space-y-0.5"
              >
                {group.label && (
                  <p
                    aria-hidden="true"
                    className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {group.label}
                  </p>
                )}
                {group.hits.map((hit) => (
                  <VaultEntryRow
                    key={hit.summary.id}
                    entry={hit.summary}
                    titleRanges={hit.titleRanges}
                    selected={hit.summary.id === selectedId}
                    onSelect={() => onSelect(hit.summary.id)}
                    actions={actions}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
});
