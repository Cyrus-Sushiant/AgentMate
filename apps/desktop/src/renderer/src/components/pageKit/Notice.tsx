import { CircleCheck, CircleInfo, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NOTICE_TONES = {
  neutral: {
    box: 'bg-foreground/[0.04] ring-foreground/[0.08]',
    icon: 'text-muted-foreground',
    Icon: CircleInfo,
  },
  primary: { box: 'bg-primary/8 ring-primary/25', icon: 'text-primary', Icon: CircleInfo },
  success: { box: 'bg-success/8 ring-success/25', icon: 'text-success', Icon: CircleCheck },
  warning: { box: 'bg-warning/10 ring-warning/30', icon: 'text-warning', Icon: TriangleAlert },
  destructive: {
    box: 'bg-destructive/10 ring-destructive/30',
    icon: 'text-destructive',
    Icon: TriangleAlert,
  },
} as const;

export type NoticeTone = keyof typeof NOTICE_TONES;

const NOTICE_SIZES = {
  sm: { box: 'px-3 py-2 text-xs', icon: 'mt-px h-3.5 w-3.5' },
  md: { box: 'px-3 py-2.5 text-sm', icon: 'mt-0.5 h-4 w-4' },
} as const;

/**
 * A tinted callout for something to know or act on: a waiting reboot, a locked vault, a failure.
 * The tone is said by the icon as well as the tint, so it never rests on colour alone. The edge
 * is an inset ring, because the app's global border colour would repaint a tinted border.
 */
export function Notice({
  tone = 'neutral',
  icon,
  iconClassName,
  action,
  size = 'md',
  className,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  tone?: NoticeTone;
  /** Replaces the tone's own icon. */
  icon?: React.ComponentType<{ className?: string }>;
  /** For an icon that moves, such as a spinner. */
  iconClassName?: string;
  /** Sits at the end of the row, like a "Try again" button. */
  action?: React.ReactNode;
  /** `sm` is for a note under one setting, `md` for one that speaks for a whole card. */
  size?: keyof typeof NOTICE_SIZES;
  children?: React.ReactNode;
}): React.JSX.Element {
  const colours = NOTICE_TONES[tone];
  const sizing = NOTICE_SIZES[size];
  const Icon = icon ?? colours.Icon;
  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-x-2.5 gap-y-2 rounded-xl text-foreground ring-1 ring-inset',
        sizing.box,
        colours.box,
        className,
      )}
      {...props}
    >
      <Icon className={cn('shrink-0', sizing.icon, colours.icon, iconClassName)} />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  );
}

/** A failed load or change, said in words, with a way to try again when there is one. */
export function Problem({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): React.JSX.Element {
  return (
    <Notice
      role="alert"
      tone="destructive"
      className="items-center"
      action={
        onRetry && (
          <Button size="sm" variant="soft" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      <span className="whitespace-pre-wrap break-words">{message}</span>
    </Notice>
  );
}
