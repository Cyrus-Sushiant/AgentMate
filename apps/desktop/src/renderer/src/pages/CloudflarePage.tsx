import { cloudflareErrorMessage } from '@shared/cloudflareErrors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Problem } from '@/components/cloudflare/fields';
import { TokenSetupCard } from '@/components/cloudflare/TokenSetupCard';
import { TokenStatusCard } from '@/components/cloudflare/TokenStatusCard';
import { isZoneTab, ZonePanel, type ZoneTab } from '@/components/cloudflare/ZonePanel';
import { ZoneRail } from '@/components/cloudflare/ZoneRail';
import { ArrowLeft, Lock } from '@/components/icons';
import { SshVaultUnlockDialog } from '@/components/remote/SshVaultUnlockDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCloudflareError } from '@/lib/cloudflare/feedback';
import { queryKeys } from '@/lib/queryKeys';
import { usePageHeader } from '@/stores/pageHeaderStore';

function BackToDeploy(): React.JSX.Element {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
      <Link to="/deploy">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Deploy
      </Link>
    </Button>
  );
}

function CloudflarePageSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6 p-6" aria-busy="true">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

/**
 * The Cloudflare page (T8). Cloudflare accounts are not tied to one server, so it lives beside
 * the server rail rather than under a server: first the token, then the zones it can see, and for
 * the picked zone its DNS records, settings and security rules. The zone and tab are kept in the
 * address, so going back and forth (and the next launch) lands in the same place.
 */
export default function CloudflarePage(): React.JSX.Element {
  usePageHeader('Cloudflare', 'Your domains on Cloudflare: DNS, settings and security rules.');
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [replacing, setReplacing] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const statusQuery = useQuery({
    queryKey: queryKeys.cloudflareStatus,
    queryFn: () => window.agentmat.cloudflare.status(),
  });
  const status = statusQuery.data;
  const ready = Boolean(status?.configured && !status.locked) && !replacing;
  const zonesQuery = useQuery({
    queryKey: queryKeys.cloudflareZones,
    queryFn: () => window.agentmat.cloudflare.listZones(),
    enabled: ready,
  });
  const zonesError = useCloudflareError(zonesQuery.error);

  if (statusQuery.isPending) return <CloudflarePageSkeleton />;

  if (statusQuery.isError) {
    return (
      <div className="space-y-4 p-6">
        <BackToDeploy />
        <Problem
          message={cloudflareErrorMessage(statusQuery.error)}
          onRetry={() => void statusQuery.refetch()}
        />
      </div>
    );
  }

  const current = statusQuery.data;
  const zones = zonesQuery.data;
  const selected = zones?.find((zone) => zone.id === params.get('zone')) ?? zones?.[0];
  const requestedTab = params.get('tab');
  const tab: ZoneTab = isZoneTab(requestedTab) ? requestedTab : 'dns';

  return (
    <div className="space-y-6 p-6">
      <BackToDeploy />
      {current.locked && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
          <Lock className="h-4 w-4 shrink-0 text-warning" />
          <p className="min-w-0 flex-1 text-sm text-foreground">
            Your saved servers are locked with a passkey, and the Cloudflare token with them. Unlock
            them to manage your domains.
          </p>
          <Button size="sm" onClick={() => setUnlockOpen(true)}>
            Unlock
          </Button>
        </div>
      )}
      {!current.configured || replacing ? (
        <TokenSetupCard
          onCancel={current.configured ? () => setReplacing(false) : undefined}
          onSaved={() => setReplacing(false)}
        />
      ) : (
        <TokenStatusCard status={current} onReplace={() => setReplacing(true)} />
      )}
      {ready && (
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <ZoneRail
            zones={zones}
            error={zonesError}
            selectedId={selected?.id ?? null}
            onSelect={(zoneId) => setParams({ zone: zoneId, tab }, { replace: true })}
            onRetry={() => void zonesQuery.refetch()}
          />
          {selected && (
            <ZonePanel
              key={selected.id}
              zone={selected}
              tab={tab}
              onTabChange={(next) => setParams({ zone: selected.id, tab: next }, { replace: true })}
            />
          )}
        </div>
      )}
      <SshVaultUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        mode="unlock"
        onUnlocked={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.sshVaultStatus });
          void queryClient.invalidateQueries({ queryKey: ['cloudflare'] });
        }}
      />
    </div>
  );
}
