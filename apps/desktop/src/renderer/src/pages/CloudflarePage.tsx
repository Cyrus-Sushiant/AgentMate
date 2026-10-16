import { cloudflareErrorMessage } from '@shared/cloudflareErrors';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Notice, Problem } from '@/components/cloudflare/fields';
import { TokenSetupCard } from '@/components/cloudflare/TokenSetupCard';
import { TokenStatusCard } from '@/components/cloudflare/TokenStatusCard';
import { isZoneTab, ZonePanel, type ZoneTab } from '@/components/cloudflare/ZonePanel';
import { type ZoneGroup, ZoneRail } from '@/components/cloudflare/ZoneRail';
import { ArrowLeft, Lock, Plus } from '@/components/icons';
import { FOOTER_HAIRLINE, GLASS_CARD, GLASS_PANEL } from '@/components/pageKit';
import { SshVaultUnlockDialog } from '@/components/remote/SshVaultUnlockDialog';
import { Button } from '@/components/ui/button';
import { ResizeHandle } from '@/components/ui/ResizeHandle';
import { Skeleton } from '@/components/ui/skeleton';
import { useCloudflareErrors } from '@/lib/cloudflare/feedback';
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
 * the server rail rather than under a server: first the tokens, one per connected account, then
 * the zones they can see, and for the picked zone its DNS records, settings and security rules.
 * The zone and tab are kept in the address, so going back and forth (and the next launch) lands
 * in the same place.
 */
export default function CloudflarePage(): React.JSX.Element {
  usePageHeader('Cloudflare', 'Your domains on Cloudflare: DNS, settings and security rules.');
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  // The account whose token is being replaced, or `true` while another account is being added.
  const [setup, setSetup] = useState<string | true | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [railWidth, setRailWidth] = usePanelWidth('cloudflareRail');

  const statusQuery = useQuery({
    queryKey: queryKeys.cloudflareStatus,
    queryFn: () => window.agentmat.cloudflare.status(),
  });
  const status = statusQuery.data;
  const ready = Boolean(status?.configured && !status.locked) && setup === null;
  const zoneQueries = useQueries({
    queries: (status?.accounts ?? []).map((account) => ({
      queryKey: queryKeys.cloudflareAccountZones(account.id),
      queryFn: () => window.agentmat.cloudflare.listZones(account.id),
      enabled: ready,
    })),
  });
  const zoneErrors = useCloudflareErrors(zoneQueries.map((query) => query.error));

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
  const groups: ZoneGroup[] = current.accounts.map((account, index) => ({
    accountId: account.id,
    label: account.label,
    zones: zoneQueries[index]?.data,
    error: zoneErrors[index] ?? null,
    onRetry: () => void zoneQueries[index]?.refetch(),
  }));
  const allZones = groups.flatMap((group) => group.zones ?? []);
  const selected = allZones.find((zone) => zone.id === params.get('zone')) ?? allZones[0];
  const requestedTab = params.get('tab');
  const tab: ZoneTab = isZoneTab(requestedTab) ? requestedTab : 'dns';
  // The token card shown above the zone: the one asked for, else the selected zone's account.
  const requestedAccount = params.get('account');
  const managed =
    current.accounts.find((account) => account.id === requestedAccount) ??
    current.accounts.find((account) => account.id === selected?.accountId) ??
    current.accounts[0];
  const several = current.accounts.length > 1;

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

  // Before there is a token to use (none saved, locked, or one being added or replaced) there are
  // no domains to list, so the page is one readable column instead of an empty rail.
  if (!ready) {
    const replacing =
      typeof setup === 'string' ? current.accounts.find((account) => account.id === setup) : null;
    const settingUp = setup !== null || !current.configured;
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
              Your saved servers are locked with a passkey, and the Cloudflare tokens with them.
              Unlock them to manage your domains.
            </Notice>
          </div>
        )}
        {settingUp ? (
          <TokenSetupCard
            account={replacing ?? undefined}
            additional={current.configured && !replacing}
            onCancel={current.configured ? () => setSetup(null) : undefined}
            onSaved={() => setSetup(null)}
          />
        ) : (
          <>
            {current.accounts.map((account) => (
              <TokenStatusCard
                key={account.id}
                account={account}
                showName={several}
                onReplace={() => setSetup(account.id)}
              />
            ))}
            <Button variant="soft" className="self-start" onClick={() => setSetup(true)}>
              <Plus className="h-3.5 w-3.5" /> Add another account
            </Button>
          </>
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
          groups={groups}
          selectedId={selected?.id ?? null}
          onSelect={(zone) => setParams({ zone: zone.id, tab }, { replace: true })}
          onManageAccount={(accountId) =>
            setParams(
              { ...(selected ? { zone: selected.id } : {}), tab, account: accountId },
              { replace: true },
            )
          }
        />
        <div className={cn(FOOTER_HAIRLINE, 'flex shrink-0 flex-col gap-1.5 p-2')}>
          <Button variant="soft" size="sm" className="w-full" onClick={() => setSetup(true)}>
            <Plus className="h-3.5 w-3.5" /> Add account
          </Button>
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
        {managed && (
          <TokenStatusCard
            key={managed.id}
            account={managed}
            showName={several}
            onReplace={() => setSetup(managed.id)}
          />
        )}
        {selected && (
          <ZonePanel
            key={selected.id}
            zone={selected}
            tab={tab}
            onTabChange={(next) =>
              setParams(
                {
                  zone: selected.id,
                  tab: next,
                  ...(requestedAccount ? { account: requestedAccount } : {}),
                },
                { replace: true },
              )
            }
          />
        )}
      </div>
      {unlockDialog}
    </div>
  );
}
