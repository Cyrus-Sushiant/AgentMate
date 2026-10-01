/**
 * A live subscription that belongs to one component. Events can arrive before the call that
 * started it has answered with its id, so they wait until then; events for other subscriptions
 * are ignored; and a component that unmounts before the id came back still stops it.
 */
export function ownedSubscription<E extends { subscriptionId: string }>(options: {
  listen: (callback: (event: E) => void) => () => void;
  start: () => Promise<string>;
  stop: (subscriptionId: string) => Promise<unknown>;
  onEvent: (event: E) => void;
  onError?: (error: unknown) => void;
  onStarted?: () => void;
}): () => void {
  let id: string | null = null;
  let disposed = false;
  const early: E[] = [];

  const off = options.listen((event) => {
    if (disposed) return;
    if (id === null) early.push(event);
    else if (event.subscriptionId === id) options.onEvent(event);
  });

  options.start().then(
    (started) => {
      if (disposed) {
        void options.stop(started).catch(() => undefined);
        return;
      }
      id = started;
      options.onStarted?.();
      for (const event of early.splice(0)) {
        if (event.subscriptionId === started) options.onEvent(event);
      }
    },
    (error: unknown) => {
      if (!disposed) options.onError?.(error);
    },
  );

  return () => {
    disposed = true;
    off();
    if (id !== null) void options.stop(id).catch(() => undefined);
  };
}
