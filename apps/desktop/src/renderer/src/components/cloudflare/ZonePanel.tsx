import type { CloudflareZone } from '@shared/cloudflareTypes';
import { CircleInfo, Globe } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccessRulesCard } from './AccessRulesCard';
import { CustomRulesCard } from './CustomRulesCard';
import { DnsRecordsCard } from './DnsRecordsCard';
import { PurgeCard } from './PurgeCard';
import { zoneStateText } from './ZoneRail';
import { ZoneSettingsCard } from './ZoneSettingsCard';

export type ZoneTab = 'dns' | 'settings' | 'security';

export function isZoneTab(value: string | null): value is ZoneTab {
  return value === 'dns' || value === 'settings' || value === 'security';
}

/** One zone: its state and, by tab, its DNS records, its settings and cache, and its rules. */
export function ZonePanel({
  zone,
  tab,
  onTabChange,
}: {
  zone: CloudflareZone;
  tab: ZoneTab;
  onTabChange: (tab: ZoneTab) => void;
}): React.JSX.Element {
  const active = zone.status === 'active' && !zone.paused;
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Globe className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground">{zone.name}</h2>
          <p className="truncate text-xs text-muted-foreground">{zone.plan || 'Cloudflare zone'}</p>
        </div>
        <Badge variant={active ? 'success' : 'warning'}>{zoneStateText(zone)}</Badge>
      </div>
      {zone.status === 'pending' && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground">
          <CircleInfo className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Cloudflare is waiting for your registrar to use its name servers:{' '}
            <span className="font-mono">{zone.nameServers.join(', ')}</span>. Until then, changes
            here do not reach visitors.
          </span>
        </p>
      )}
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as ZoneTab)}>
        <TabsList>
          <TabsTrigger value="dns">DNS</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        <TabsContent value="dns" className="pt-4">
          <DnsRecordsCard zone={zone} />
        </TabsContent>
        <TabsContent value="settings" className="space-y-4 pt-4">
          <ZoneSettingsCard zone={zone} />
          <PurgeCard zone={zone} />
        </TabsContent>
        <TabsContent value="security" className="space-y-4 pt-4">
          <CustomRulesCard zone={zone} />
          <AccessRulesCard zone={zone} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
