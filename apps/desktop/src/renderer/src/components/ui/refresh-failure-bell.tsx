import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell } from '@/components/icons';
import type { RefreshFailure } from '@/hooks/useLastGoodData';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

const SWING = { rotate: [0, 22, -18, 12, -8, 4, 0] };

/**
 * The little alert that sits on a refresh button after a refresh failed and the
 * page kept showing older data. The bell swings each time another attempt fails
 * and the count rolls over, so a retry that still fails is visibly "new".
 *
 * Place it inside a `relative` wrapper around the button.
 */
export function RefreshFailureBell({
  failure,
  className,
}: {
  failure: RefreshFailure | null;
  className?: string;
}): React.JSX.Element {
  const reduced = useReducedMotion() ?? false;

  return (
    <AnimatePresence>
      {failure ? (
        <motion.span
          key="bell"
          aria-hidden
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          className={cn(
            'pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center gap-0.5 rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground shadow-sm ring-2 ring-background',
            className,
          )}
        >
          <motion.span
            key={failure.count}
            className="flex origin-top"
            animate={reduced ? undefined : SWING}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
          >
            <Bell className="h-2.5 w-2.5" />
          </motion.span>
          {failure.count > 1 ? (
            <span className="relative flex h-2.5 overflow-hidden tabular-nums">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={failure.count}
                  initial={reduced ? { opacity: 0 } : { y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduced ? { opacity: 0 } : { y: 10, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {failure.count > 9 ? '9+' : failure.count}
                </motion.span>
              </AnimatePresence>
            </span>
          ) : null}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

/** Tooltip copy for a refresh button, explaining the bell when it is up. */
export function refreshTooltip(
  label: string,
  failure: RefreshFailure | null,
  savedAt: number | null,
): string {
  if (!failure) return label;
  const shown = savedAt ? ` Showing data from ${timeAgo(new Date(savedAt).toISOString())}.` : '';
  return `Last refresh failed: ${failure.message}${shown}\nClick to try again.`;
}
