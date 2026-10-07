import { RefreshCw, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { GLASS_CARD } from './styles';

/** Something that did not load, in its own glass card, with a way to try again. */
export function LoadFailure({
  message,
  retry,
}: {
  message: React.ReactNode;
  retry: () => void;
}): React.JSX.Element {
  return (
    <div role="alert" className={GLASS_CARD}>
      {/* The tint sits on an inner layer, since .glass owns the card's background. */}
      <div className="flex flex-wrap items-center gap-2 rounded-[inherit] bg-destructive/[0.05] px-3 py-2.5 text-sm text-destructive ring-1 ring-inset ring-destructive/30">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">{message}</span>
        <Button size="sm" variant="soft" onClick={retry}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    </div>
  );
}
