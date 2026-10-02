import { FIREWALL_POLICIES } from '@shared/deploy/firewallValidation';
import type {
  FirewallPolicy,
  FirewallStatus,
} from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { Lock, LockOpen, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BACKEND_LABEL, POLICY_LABEL } from '@/lib/deploy/firewall/format';
import { cn } from '@/lib/utils';

/**
 * The firewall at a glance: on or off (a word and a lock, never colour alone), which backend,
 * the default policies, IPv6, and the SSH ports the guard keeps open. Admins turn it on or off
 * and change the incoming default from here; both go through the preview like any change.
 */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function StatusHero({
  status,
  loading,
  error,
  stale,
  canAdmin,
  busy,
  stagedIncoming,
  onToggle,
  onDefaultIncoming,
}: {
  status: FirewallStatus | undefined;
  loading: boolean;
  error: string | null;
  stale: boolean;
  canAdmin: boolean;
  /** A change is being staged or waits for its confirmation. */
  busy: boolean;
  /** An incoming default staged but not applied yet. */
  stagedIncoming?: FirewallPolicy;
  onToggle: (on: boolean) => void;
  onDefaultIncoming: (policy: FirewallPolicy) => void;
}): React.JSX.Element {
  if (loading && !status) {
    return (
      <Card className="glass" aria-busy="true">
        <CardContent className="flex flex-wrap items-center gap-6 p-5">
          <Skeleton className="h-14 w-40" />
          <Skeleton className="h-10 flex-1" />
        </CardContent>
      </Card>
    );
  }
  if (!status) {
    return (
      <Card className="glass">
        <CardContent className="p-5 text-sm text-destructive" role="alert">
          {error ?? 'The firewall could not be read.'}
        </CardContent>
      </Card>
    );
  }

  const none = status.backend === 'none' || !status.installed;
  const on = status.active && !none;
  const Mark = on ? Lock : LockOpen;
  return (
    <Card className={cn('glass transition-opacity', stale && 'opacity-60')}>
      <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
        <div className="flex items-center gap-3" aria-label="Firewall state">
          <span
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full border',
              on
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-warning/40 bg-warning/10 text-warning',
            )}
          >
            <Mark className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-semibold leading-tight text-foreground">
              {none ? 'No firewall found' : on ? 'Firewall on' : 'Firewall off'}
            </p>
            <p className="text-xs text-muted-foreground">
              {none
                ? 'Neither ufw nor firewalld is installed.'
                : on
                  ? 'Only what the rules allow gets in.'
                  : 'Every port that listens can be reached.'}
            </p>
          </div>
        </div>

        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
          <Fact label="Backend">
            {BACKEND_LABEL[status.backend]}
            {status.zone ? ` (zone ${status.zone})` : ''}
          </Fact>
          <Fact label="Incoming">
            {canAdmin && !none && !busy ? (
              <select
                aria-label="Incoming by default"
                className="rounded border border-input bg-background px-1 py-0.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={stagedIncoming ?? status.defaultIncoming}
                onChange={(event) => onDefaultIncoming(event.target.value as FirewallPolicy)}
              >
                {FIREWALL_POLICIES.map((policy) => (
                  <option key={policy} value={policy}>
                    {POLICY_LABEL[policy]} by default
                  </option>
                ))}
              </select>
            ) : (
              `${POLICY_LABEL[status.defaultIncoming]} by default`
            )}
          </Fact>
          <Fact label="Outgoing">{POLICY_LABEL[status.defaultOutgoing]} by default</Fact>
          <Fact label="IPv6">{status.ipv6 ? 'Filtered too' : 'Not filtered'}</Fact>
          <Fact label="SSH ports">
            {status.ssh.ports.length > 0 ? (
              <span className="font-mono tabular-nums">{status.ssh.ports.join(', ')}</span>
            ) : (
              (status.ssh.error ?? 'Unknown')
            )}
          </Fact>
        </dl>

        {canAdmin && !none && (
          <Button
            size="sm"
            variant={on ? 'outline' : 'default'}
            disabled={busy}
            onClick={() => onToggle(!on)}
          >
            {on ? 'Turn off' : 'Turn on'}
          </Button>
        )}
      </CardContent>
      {(status.warnings.length > 0 || status.error) && (
        <ul className="space-y-1 border-t border-border px-5 py-3 text-xs text-warning">
          {[...(status.error ? [status.error] : []), ...status.warnings].map((warning) => (
            <li key={warning} className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" /> {warning}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
