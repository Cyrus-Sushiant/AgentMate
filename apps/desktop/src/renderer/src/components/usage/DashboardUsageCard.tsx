import { useNavigate } from 'react-router-dom';
import { getUsageProvider, type ProviderUsage, type WidgetMode } from '@agentmat/core';
import { ExternalLink, X } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { ProviderLogo } from '@/components/providerLogos';
import { UsageCardBody, UsageCardBodySkeleton } from '@/components/usage/UsageCard';

export interface DashboardUsageCardProps {
  providerId: string;
  /** Undefined until the scan lands, or when the provider is no longer tracked. */
  usage: ProviderUsage | undefined;
  /** Which view the Usage page card is showing; the dashboard mirrors it. */
  mode: WidgetMode;
  loading: boolean;
  /** Omitted outside the dashboard's edit mode, which hides the remove button. */
  onRemove?: () => void;
  /** The shared drag handle, so these cards reorder alongside the stat charts. */
  dragHandle?: React.ReactNode;
  className?: string;
}

/**
 * A Token Usage provider card living on the dashboard. It's the same body the
 * Usage page and the desktop widgets render — only the surrounding chrome
 * differs (remove instead of pin, plus a shortcut back to the Usage page).
 */
export function DashboardUsageCard({
  providerId,
  usage,
  mode,
  loading,
  onRemove,
  dragHandle,
  className,
}: DashboardUsageCardProps): React.JSX.Element | null {
  const navigate = useNavigate();
  const def = getUsageProvider(providerId);
  if (!def) return null;

  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col p-4">
        <div className="mb-2 flex items-center gap-1">
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <ProviderLogo providerId={providerId} className="h-5 w-5 shrink-0" />
            <span className="truncate text-sm font-semibold">{def.name}</span>
            {mode === 'subscription' && usage?.subscription?.plan && (
              <Badge variant="outline" className="shrink-0">
                {usage.subscription.plan.label}
              </Badge>
            )}
          </div>
          {dragHandle}
          <SimpleTooltip label="Open Token Usage">
            <Button variant="ghost" size="icon" onClick={() => navigate('/usage')}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </SimpleTooltip>
          {onRemove && (
            <SimpleTooltip label="Remove from dashboard">
              <Button variant="ghost" size="icon" onClick={onRemove}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
          )}
        </div>
        {usage ? (
          <UsageCardBody usage={usage} def={def} hideHeader mode={mode} />
        ) : loading ? (
          <UsageCardBodySkeleton />
        ) : (
          <div className="flex flex-1 items-center text-sm text-muted-foreground">
            No longer tracked on the Token Usage page.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
