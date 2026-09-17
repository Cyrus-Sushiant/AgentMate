import { avatarHue, avatarLetter, type VaultEntrySummary } from '@agentmat/core';
import { cn } from '@/lib/utils';
import { ENTRY_TYPE_META } from './entryTypes';

/**
 * A letter tile tinted by site (or title), so the same account keeps its color everywhere.
 * Letters rather than favicons: the app never fetches remote images, and a favicon request
 * would tell every site which accounts you keep.
 */
export function EntryAvatar({
  entry,
  size = 'md',
}: {
  entry: Pick<VaultEntrySummary, 'title' | 'host' | 'type'>;
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
      )}
      style={{
        backgroundColor: `hsl(${hue} 70% 50% / 0.16)`,
        color: `hsl(${hue} 65% 42%)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 70% 50% / 0.28)`,
      }}
    >
      {avatarLetter(entry.title)}
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
