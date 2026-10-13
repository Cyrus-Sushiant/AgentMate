import { Github, Spinner } from '@/components/icons';
import { EmptyState } from '@/components/pageKit';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PanelNoticeAction = {
  label: string;
  run: () => void;
  /** Swaps in a spinner and `pendingLabel`. Clicks are ignored until it settles. */
  pending?: boolean;
  pendingLabel?: string;
};

/**
 * What a panel tab or section shows when it has nothing to list: the glowing empty state, sized
 * for the narrow panel, with an optional way out.
 */
export function PanelNotice({
  title,
  body,
  action,
  icon = Github,
}: {
  title: string;
  body: React.ReactNode;
  action?: PanelNoticeAction;
  icon?: React.ComponentType<{ className?: string }>;
}): React.JSX.Element {
  // aria-disabled rather than disabled, so the button keeps its color and focus while it works.
  const pending = action?.pending ?? false;
  return (
    <EmptyState
      size="sm"
      icon={icon}
      title={title}
      busy={pending}
      description={<span className="block text-xs">{body}</span>}
      action={
        action ? (
          <Button
            type="button"
            variant="soft"
            size="xs"
            aria-disabled={pending || undefined}
            aria-busy={pending || undefined}
            onClick={pending ? undefined : action.run}
            className={cn(pending && 'cursor-progress')}
          >
            {pending ? <Spinner className="motion-safe:animate-spin" /> : null}
            {pending ? (action.pendingLabel ?? action.label) : action.label}
          </Button>
        ) : undefined
      }
      className="gap-2.5 px-4 py-5"
    />
  );
}
