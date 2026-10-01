import type { DeployConnection, DeployConnectionState } from '@shared/deployTypes';
import { Lock, Spinner } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useDeployConnection } from './hooks';

/**
 * The server's lasting connection, in a word and a mark, so it never relies on colour: a
 * pulsing dot when connected, a spinner while on the way, a hollow ring when not connected and
 * a lock when it waits for the user. The tooltip says why and what happens next.
 */

const LABEL: Record<DeployConnectionState, string> = {
  connecting: 'Connecting',
  online: 'Connected',
  reconnecting: 'Reconnecting',
  offline: 'Not connected',
  'needs-sign-in': 'Sign-in needed',
  'needs-re-enroll': 'Access to set up again',
  locked: 'Servers locked',
};

function explain(connection: DeployConnection | undefined, now: number): string {
  if (!connection) return 'Checking the connection to the server core.';
  const retry =
    connection.retryAt !== undefined
      ? ` Trying again in ${Math.max(1, Math.round((connection.retryAt - now) / 1000))} s.`
      : '';
  switch (connection.state) {
    case 'online':
      return 'Live: metrics, alerts and job logs arrive as they happen.';
    case 'connecting':
      return 'Opening a live connection to the server core.';
    case 'reconnecting':
      return `The connection dropped and is being tried again by itself.${retry}`;
    case 'offline':
      return connection.message
        ? `${connection.message}${retry}`
        : 'Opens by itself when this page needs the server core.';
    case 'needs-sign-in':
      return 'Sign in to the server core to connect again.';
    case 'needs-re-enroll':
      return 'This computer has to be set up on the server core again.';
    case 'locked':
      return 'Unlock your saved servers to connect.';
  }
}

export function ConnectionMark({
  state,
  className,
}: {
  state: DeployConnectionState | undefined;
  className?: string;
}): React.JSX.Element {
  if (state === 'online') {
    return (
      <span className={cn('relative flex h-2 w-2', className)} aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
    );
  }
  if (state === undefined || state === 'connecting' || state === 'reconnecting') {
    return (
      <Spinner
        className={cn(
          'h-3 w-3 motion-safe:animate-spin',
          state === 'reconnecting' ? 'text-warning' : 'text-muted-foreground',
          className,
        )}
      />
    );
  }
  if (state === 'offline') {
    return (
      <span
        aria-hidden
        className={cn('h-2 w-2 rounded-full border-2 border-muted-foreground/60', className)}
      />
    );
  }
  return <Lock className={cn('h-3 w-3 text-warning', className)} />;
}

export function ConnectionBadge({ serverId }: { serverId: string }): React.JSX.Element {
  const connection = useDeployConnection(serverId);
  const state = connection?.state;
  return (
    <SimpleTooltip label={explain(connection, Date.now())}>
      <span
        role="status"
        aria-label={`Live connection: ${state ? LABEL[state] : 'Checking'}`}
        tabIndex={0}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          state === 'online'
            ? 'border-success/40 bg-success/10 text-foreground'
            : state === 'reconnecting' || state === 'needs-sign-in' || state === 'locked'
              ? 'border-warning/40 bg-warning/10 text-foreground'
              : 'border-border bg-secondary/40 text-muted-foreground',
        )}
      >
        <ConnectionMark state={state} />
        {state ? LABEL[state] : 'Checking'}
      </span>
    </SimpleTooltip>
  );
}
