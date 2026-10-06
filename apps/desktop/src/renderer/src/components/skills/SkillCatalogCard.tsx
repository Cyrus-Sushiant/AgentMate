import { CircleCheck } from '@/components/icons';
import { FOOTER_HAIRLINE, GLASS_CARD } from '@/components/pageKit';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * One skill in a catalog grid (the skills.sh directory, a repository, the favorites). Every tab
 * draws the same glass card, so a skill looks the same wherever it is found: the name and its
 * star on top, what it does, its chips, where it comes from, and the actions along a hairline
 * footer.
 */
export function SkillCatalogCard({
  title,
  official = false,
  officialHint = 'Official: skills.sh has verified this publisher',
  trailing,
  description,
  chips,
  meta,
  actions,
}: {
  title: string;
  official?: boolean;
  officialHint?: string;
  /** Sits at the top-right corner, usually the favorite star. */
  trailing?: React.ReactNode;
  description?: React.ReactNode;
  chips?: React.ReactNode;
  meta?: React.ReactNode;
  actions: React.ReactNode;
}): React.JSX.Element {
  return (
    <article
      aria-label={title}
      className={cn(
        GLASS_CARD,
        // The hover edge is an inset ring, because the global border colour wins over a tinted
        // border utility.
        'flex flex-col ring-1 ring-inset ring-transparent transition-shadow hover:ring-primary/30',
      )}
    >
      <div className="flex flex-1 flex-col gap-2.5 p-4 pb-3">
        <div className="flex items-start gap-2">
          <h3 className="flex min-w-0 flex-1 items-center gap-1.5 break-words text-sm font-semibold leading-snug">
            <span className="min-w-0">{title}</span>
            {official && (
              <SimpleTooltip label={officialHint}>
                <CircleCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              </SimpleTooltip>
            )}
          </h3>
          {trailing}
        </div>
        {description ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {chips ? <div className="flex flex-wrap items-center gap-1.5">{chips}</div> : null}
        {meta ? <div className="mt-auto truncate text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      <div className={cn('flex items-center gap-1.5 px-3 py-2.5', FOOTER_HAIRLINE)}>{actions}</div>
    </article>
  );
}
