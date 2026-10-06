import type { VaultEntrySummary } from '@agentmat/core';
import { motion } from 'framer-motion';
import { Copy, Key, Star } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { EntryAvatar } from './EntryAvatar';
import { entrySubtitle, primarySecret } from './entryTypes';
import type { useVaultActions } from './useVaultActions';

export function vaultOptionId(id: string): string {
  return `vault-option-${id}`;
}

const ROW_BUTTON =
  'flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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
  pillTransition,
}: {
  entry: VaultEntrySummary;
  titleRanges: [number, number][];
  selected: boolean;
  onSelect: () => void;
  actions: ReturnType<typeof useVaultActions>;
  /** How the selection pill slides between rows; instant when motion is reduced. */
  pillTransition?: React.ComponentProps<typeof motion.span>['transition'];
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
        // `isolate` keeps the selection pill behind the row's content without lifting each child.
        'group relative isolate flex h-12 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 outline-none transition-colors',
        !selected && 'hover:bg-foreground/[0.06]',
      )}
    >
      {selected && (
        <motion.span
          aria-hidden
          layoutId="vault-entry-active"
          transition={pillTransition}
          className="absolute inset-0 -z-10 rounded-lg bg-primary/12"
        >
          <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]" />
        </motion.span>
      )}
      <EntryAvatar entry={entry} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-[13px] font-medium leading-5',
            selected ? 'text-primary' : 'text-foreground',
          )}
        >
          <Highlighted text={entry.title} ranges={titleRanges} />
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{entrySubtitle(entry)}</p>
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
              className={ROW_BUTTON}
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
              className={ROW_BUTTON}
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
