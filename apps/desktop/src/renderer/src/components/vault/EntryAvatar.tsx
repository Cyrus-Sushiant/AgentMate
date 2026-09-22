import { avatarHue, avatarLetter, type VaultEntrySummary } from '@agentmat/core';
import { cn } from '@/lib/utils';
import { ENTRY_TYPE_META } from './entryTypes';

/**
 * The entry's saved favicon, or a letter tile tinted by site (or title) so the same account
 * keeps its color everywhere. The favicon is only ever downloaded from the editor and then
 * stored in the vault, so drawing the list never contacts a site.
 */
export function EntryAvatar({
  entry,
  size = 'md',
}: {
  entry: Pick<VaultEntrySummary, 'title' | 'host' | 'type' | 'icon'>;
  size?: 'sm' | 'md' | 'lg';
}): React.JSX.Element {
  const hue = avatarHue(entry.host || entry.title.toLowerCase());
  const TypeIcon = ENTRY_TYPE_META[entry.type].icon;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-lg font-semibold',
        size === 'lg' && 'h-12 w-12 text-lg',
        size === 'md' && 'h-9 w-9 text-sm',
        size === 'sm' && 'h-6 w-6 rounded-md text-[11px]',
        entry.icon && 'bg-background ring-1 ring-inset ring-border',
      )}
      style={
        entry.icon
          ? undefined
          : {
              backgroundColor: `hsl(${hue} 70% 50% / 0.16)`,
              color: `hsl(${hue} 65% 42%)`,
              boxShadow: `inset 0 0 0 1px hsl(${hue} 70% 50% / 0.28)`,
            }
      }
    >
      {entry.icon ? (
        <img
          src={entry.icon}
          alt=""
          draggable={false}
          className={cn('object-contain', size === 'sm' ? 'h-4 w-4' : 'h-3/5 w-3/5')}
        />
      ) : (
        avatarLetter(entry.title)
      )}
      {entry.type !== 'login' && size !== 'sm' && (
        <span
          className={cn(
            'absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground',
            size === 'lg' ? 'h-5 w-5' : 'h-4 w-4',
          )}
        >
          <TypeIcon className={size === 'lg' ? 'h-2.5 w-2.5' : 'h-2 w-2'} />
        </span>
      )}
    </span>
  );
}
