import { cn } from '@/lib/utils';
import { GLASS_CARD } from './styles';

const TILE_TONE = {
  primary: 'bg-primary/12 text-primary',
  destructive: 'bg-destructive/12 text-destructive',
  neutral: 'bg-foreground/[0.06] text-foreground/80',
} as const;

export type SectionCardTone = keyof typeof TILE_TONE;

interface SectionCardHeaderProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Sits right after the title, for a status chip or a count. */
  extra?: React.ReactNode;
  actions?: React.ReactNode;
  /** The colour of the icon tile. */
  tone?: SectionCardTone;
  /**
   * The title's heading level. A card that is a page's own section is an h2; a card inside a
   * panel that already has its own heading is an h3.
   */
  headingLevel?: 2 | 3;
}

/**
 * A card's title row: the tinted icon tile, the title and a line about it, and the card's own
 * actions on the right. The title stays a heading, so tests and screen readers can find the card
 * by it. `TileHeader` is the compact one-line header for small tiles; this one is for sections.
 */
export function SectionCardHeader({
  icon,
  title,
  description,
  extra,
  actions,
  tone = 'primary',
  headingLevel = 3,
  className,
}: SectionCardHeaderProps & { className?: string }): React.JSX.Element {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div
      className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-3 p-4', className)}
    >
      <div className="flex min-w-[min(100%,16rem)] flex-1 items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-4',
            TILE_TONE[tone],
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Heading className="min-w-0 break-words text-sm font-semibold leading-tight">
              {title}
            </Heading>
            {extra}
          </div>
          {description ? (
            <div className="text-xs leading-relaxed text-muted-foreground">{description}</div>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>
      ) : null}
    </div>
  );
}

/** The padded body under a card's header, for a `flush` card that pads only some of its parts. */
export function SectionCardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className={cn('px-4 pb-4', className)}>{children}</div>;
}

/**
 * A page section as a glass card: the header row, then its content. The content is padded to
 * line up with the header unless the card is `flush`, which lets lists and tables run edge to
 * edge and draw hairline rows the way the Settings cards do.
 */
export function SectionCard({
  icon,
  title,
  description,
  extra,
  actions,
  tone,
  headingLevel,
  flush = false,
  className,
  bodyClassName,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLElement>, 'title'> &
  SectionCardHeaderProps & {
    /** Children go straight under the header, with no padding of their own. */
    flush?: boolean;
    /** Classes for the padded body; unused on a `flush` card. */
    bodyClassName?: string;
  }): React.JSX.Element {
  return (
    <section className={cn(GLASS_CARD, className)} {...props}>
      <SectionCardHeader
        icon={icon}
        title={title}
        description={description}
        extra={extra}
        actions={actions}
        tone={tone}
        headingLevel={headingLevel}
      />
      {flush ? (
        children
      ) : children ? (
        <SectionCardBody className={bodyClassName}>{children}</SectionCardBody>
      ) : null}
    </section>
  );
}
