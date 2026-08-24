import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useDelayedLoading } from './useDelayedLoading';

/** How long to wait for a first query before calling the boot finished anyway. */
const BOOT_GRACE_MS = 1500;

/**
 * Whether the full-page loading overlay should be up.
 *
 * It belongs to the app's cold start only: on the very first paint there is no
 * content on screen to shimmer, so the logo covers the wait. Once that first
 * batch of queries settles the overlay is retired for the rest of the session.
 * Opening another page, a background refetch or a poll is shown inline by
 * whichever card is still waiting (see `ui/skeleton.tsx`) instead of blanking
 * out the page the user is reading. Mutations keep the overlay: they block on a
 * write the user just asked for, unless they report progress on their own
 * button (see `meta.silentLoading` below).
 */
export function useAppLoadingOverlay(): boolean {
  // A query that already has data is refreshing in place, so it isn't part of
  // the boot. `meta.silentLoading` opts a query out entirely (e.g. the
  // dashboard's IP lookup and CLI update checks).
  const bootFetching = useIsFetching({
    predicate: (query) => !query.meta?.silentLoading && query.state.data === undefined,
  });
  // Same opt-out for writes: a mutation whose button shows its own spinner has
  // no business blanking the page around it (e.g. every git action).
  const isMutating = useIsMutating({
    predicate: (mutation) => !mutation.options.meta?.silentLoading,
  });
  const [booted, setBooted] = useState(false);
  const sawFetch = useRef(false);

  useEffect(() => {
    if (booted) return undefined;
    if (bootFetching > 0) {
      sawFetch.current = true;
      return undefined;
    }
    // Idle again after the first page fired its queries: the boot is over.
    if (sawFetch.current) {
      setBooted(true);
      return undefined;
    }
    // Nothing has started yet. The landing page may have no queries at all, so
    // don't leave the session waiting on a boot that never happens.
    const timer = setTimeout(() => setBooted(true), BOOT_GRACE_MS);
    return () => clearTimeout(timer);
  }, [booted, bootFetching]);

  return useDelayedLoading((!booted && bootFetching > 0) || isMutating > 0);
}
