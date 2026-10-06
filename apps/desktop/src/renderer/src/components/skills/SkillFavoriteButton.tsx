import { Star } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * The star that puts a skill in Favorites, on every surface that lists skills. It is told
 * whether the skill is starred rather than reading the list itself, so a memoized grid of cards
 * doesn't re-render on every parent render.
 */
export function SkillFavoriteButton({
  starred,
  onToggle,
  className,
}: {
  starred: boolean;
  onToggle: () => void;
  className?: string;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={starred ? 'Remove from favorites' : 'Add to favorites'}>
      <Button
        variant="ghost"
        size="icon"
        aria-pressed={starred}
        className={cn('h-7 w-7 rounded-full hover:bg-foreground/[0.06]', className)}
        onClick={onToggle}
      >
        <Star
          className={cn(
            'h-3.5 w-3.5 transition-colors',
            starred ? 'text-warning' : 'text-muted-foreground/50',
          )}
        />
      </Button>
    </SimpleTooltip>
  );
}
