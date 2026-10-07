import { cloudflareErrorMessage } from '@shared/cloudflareErrors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Notice, Problem } from '@/components/cloudflare/fields';
import { TokenSetupCard } from '@/components/cloudflare/TokenSetupCard';
import { TokenStatusCard } from '@/components/cloudflare/TokenStatusCard';
import { isZoneTab, ZonePanel, type ZoneTab } from '@/components/cloudflare/ZonePanel';
import { ZoneRail } from '@/components/cloudflare/ZoneRail';
import { ArrowLeft, Lock } from '@/components/icons';
import { FOOTER_HAIRLINE, GLASS_CARD, GLASS_PANEL } from '@/components/pageKit';
import { SshVaultUnlockDialog } from '@/components/remote/SshVaultUnlockDialog';
import { Button } from '@/components/ui/button';
import { ResizeHandle } from '@/components/ui/ResizeHandle';
import { Skeleton } from '@/components/ui/skeleton';
import { useCloudflareError } from '@/lib/cloudflare/feedback';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { PANEL_WIDTHS, usePanelWidth } from '@/stores/panelWidthStore';

function BackToDeploy({ className }: { className?: string }): React.JSX.Element {
  return (
    <Button asChild variant="soft" size="sm" className={className}>
      <Link to="/deploy">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Deploy
      </Link>
    </Button>
  );
}

/** The cards the page will show, shimmering in their own places while the status loads. */
function CloudflarePageSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 p-2" aria-busy="true">
      <Skeleton className="h-8 w-36 rounded-full" />
      <div className={cn(GLASS_CARD, 'space-y-3 p-4')}>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
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
  const [railWidth, setRailWidth] = usePanelWidth('cloudflareRail');

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
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-2 p-2">
        <BackToDeploy />
        <div className="w-full">
          <Problem
            message={cloudflareErrorMessage(statusQuery.error)}
            onRetry={() => void statusQuery.refetch()}
          />
        </div>
      </div>
    );
  }

  const current = statusQuery.data;
  const zones = zonesQuery.data;
  const selected = zones?.find((zone) => zone.id === params.get('zone')) ?? zones?.[0];
  const requestedTab = params.get('tab');
  const tab: ZoneTab = isZoneTab(requestedTab) ? requestedTab : 'dns';

  const unlockDialog = (
    <SshVaultUnlockDialog
      open={unlockOpen}
      onOpenChange={setUnlockOpen}
      mode="unlock"
      onUnlocked={() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sshVaultStatus });
        void queryClient.invalidateQueries({ queryKey: ['cloudflare'] });
      }}
    />
  );

  // Before there is a token to use (none saved, locked, or being replaced) there are no domains
  // to list, so the page is one readable column instead of an empty rail.
  if (!ready) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-stretch gap-2 p-2">
        <BackToDeploy className="self-start" />
        {current.locked && (
          // The tint sits inside a glass card, since the unlayered .glass fill would cover it.
          <div className={cn(GLASS_CARD, 'p-1.5')}>
            <Notice
              tone="warning"
              icon={Lock}
              className="items-center"
              action={
                <Button size="sm" onClick={() => setUnlockOpen(true)}>
                  Unlock
                </Button>
              }
            >
              Your saved servers are locked with a passkey, and the Cloudflare token with them.
              Unlock them to manage your domains.
            </Notice>
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
        {unlockDialog}
      </div>
    );
  }

  return (
    // The domain list and the zone are glass cards side by side on the island, the way the API
    // Client lays out its collections and request. The gap between them is the resize handle.
    <div className="flex min-h-0 flex-1 overflow-hidden p-2">
      <aside
        aria-label="Cloudflare domains"
        // The cap keeps a wide saved width from squeezing the zone on a narrow window.
        style={{ width: railWidth, maxWidth: '40%' }}
        className={cn(GLASS_PANEL, 'shrink-0')}
      >
        <ZoneRail
          zones={zones}
          error={zonesError}
          selectedId={selected?.id ?? null}
          onSelect={(zoneId) => setParams({ zone: zoneId, tab }, { replace: true })}
          onRetry={() => void zonesQuery.refetch()}
        />
        <div className={cn(FOOTER_HAIRLINE, 'shrink-0 p-2')}>
          <BackToDeploy className="w-full" />
        </div>
      </aside>
      <ResizeHandle
        orientation="vertical"
        label="Resize domains"
        size={railWidth}
        min={PANEL_WIDTHS.cloudflareRail.min}
        max={PANEL_WIDTHS.cloudflareRail.max}
        defaultSize={PANEL_WIDTHS.cloudflareRail.default}
        onSizeChange={setRailWidth}
        quiet
        className="w-2"
      />
      <div className="rail-scroll flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
        <TokenStatusCard status={current} onReplace={() => setReplacing(true)} />
        {selected && (
          <ZonePanel
            key={selected.id}
            zone={selected}
            tab={tab}
            onTabChange={(next) => setParams({ zone: selected.id, tab: next }, { replace: true })}
          />
        )}
      </div>
      {unlockDialog}
    </div>
  );
}
