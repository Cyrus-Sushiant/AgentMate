import type { VaultEntrySummary } from '@agentmat/core';
import { Copy, Key, Star } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { EntryAvatar } from './EntryAvatar';
import { entrySubtitle, primarySecret } from './entryTypes';
import type { useVaultActions } from './useVaultActions';

export function vaultOptionId(id: string): string {
  return `vault-option-${id}`;
}

function Highlighted({ text, ranges }: { text: string; ranges: [number, number][] }) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className="rounded-[3px] bg-primary/20 px-px text-foreground">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

export function VaultEntryRow({
  entry,
  titleRanges,
  selected,
  onSelect,
  actions,
}: {
  entry: VaultEntrySummary;
  titleRanges: [number, number][];
  selected: boolean;
  onSelect: () => void;
  actions: ReturnType<typeof useVaultActions>;
}): React.JSX.Element {
  const secret = primarySecret(entry);
  const canCopyUsername = entry.type === 'login' && entry.username !== '';

  return (
    <div
      role="option"
      id={vaultOptionId(entry.id)}
      aria-selected={selected}
      data-title={entry.title}
      tabIndex={-1}
      onClick={onSelect}
      onKeyDown={(event) => event.key === 'Enter' && onSelect()}
      className={cn(
        'group relative flex h-14 cursor-pointer items-center gap-3 rounded-lg px-2.5 outline-none transition-colors',
        selected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-accent/60',
      )}
    >
      <EntryAvatar entry={entry} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-5">
          <Highlighted text={entry.title} ranges={titleRanges} />
        </p>
        <p className="truncate text-xs text-muted-foreground">{entrySubtitle(entry)}</p>
      </div>

      <div
        className={cn(
          'flex items-center gap-0.5 transition-opacity',
          selected
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {canCopyUsername && (
          <SimpleTooltip label="Copy username">
            <button
              type="button"
              aria-label="Copy username"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                void actions.copy(entry.id, 'username', 'Username');
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </SimpleTooltip>
        )}
        {secret && (
          <SimpleTooltip label={`Copy ${secret.label.toLowerCase()}`}>
            <button
              type="button"
              aria-label={`Copy ${secret.label.toLowerCase()}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                void actions.copy(entry.id, secret.ref, secret.label);
              }}
            >
              <Key className="h-3.5 w-3.5" />
            </button>
          </SimpleTooltip>
        )}
      </div>
      {entry.favorite && <Star className="h-3 w-3 shrink-0 text-warning" />}
    </div>
  );
}
