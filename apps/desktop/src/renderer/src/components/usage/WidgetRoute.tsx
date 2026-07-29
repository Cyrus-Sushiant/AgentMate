import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getUsageProvider, type WidgetMode } from '@agentmat/core';
import { ChartColumn, Clock, X } from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { UsageCardBody, UsageCardBodySkeleton, hasSubscriptionView } from './UsageCard';

/**
 * Standalone render target for a floating desktop widget window
 * (loaded at #/widget/:id). No AppShell/sidebar; a transparent page with a
 * frosted-glass card, an OS-drag strip, and a close button.
 */
export default function WidgetRoute(): React.JSX.Element {
  const { id = '' } = useParams();

  // Make the whole document see-through so the glass card blurs the desktop.
  useEffect(() => {
    document.documentElement.setAttribute('data-widget', '');
    return () => document.documentElement.removeAttribute('data-widget');
  }, []);

  const instanceQuery = useQuery({
    queryKey: ['usage-widget-instance', id],
    queryFn: () => window.agentmat.usage.getWidget(id),
  });

  const instance = instanceQuery.data ?? null;
  const providerId = instance?.providerId;

  // Re-read the instance when the main process reports a style/size change.
  useEffect(() => {
    return window.agentmat.usage.onWidgetUpdated((payload) => {
      if (payload.id === id) void instanceQuery.refetch();
    });
  }, [id, instanceQuery]);

  const usageQuery = useQuery({
    queryKey: ['usage-widget-data', providerId],
    queryFn: () => window.agentmat.usage.get(providerId as string),
    enabled: !!providerId,
    refetchInterval: 60_000,
  });

  const def = providerId ? getUsageProvider(providerId) : undefined;
  const usage = usageQuery.data;
  // Widgets pinned before modes existed have no `mode`, so they are token
  // widgets and must stay that way.
  const mode = instance?.mode ?? 'tokens';

  const showingLimits = mode === 'subscription' && !!usage && hasSubscriptionView(usage);
  const canToggle = !!usage && hasSubscriptionView(usage);

  async function toggleMode(): Promise<void> {
    const next: WidgetMode = showingLimits ? 'tokens' : 'subscription';
    await window.agentmat.usage.setWidgetMode(id, next);
    await instanceQuery.refetch();
  }

  return (
    <div className="glass flex h-screen w-screen flex-col overflow-hidden rounded-2xl">
      <div className="widget-drag flex h-6 shrink-0 items-center justify-end px-2">
        {canToggle && (
          <SimpleTooltip
            label={showingLimits ? 'Show tokens and cost' : 'Show plan limits'}
            side="bottom"
          >
            <button
              className="widget-no-drag flex h-5 w-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground"
              onClick={() => void toggleMode()}
            >
              {showingLimits ? <ChartColumn className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            </button>
          </SimpleTooltip>
        )}
        <SimpleTooltip label="Close widget" side="bottom">
          <button
            className="widget-no-drag flex h-5 w-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground"
            onClick={() => void window.agentmat.usage.closeWidget(id)}
          >
            <X className="h-3 w-3" />
          </button>
        </SimpleTooltip>
      </div>
      <div className="min-h-0 flex-1 px-3 pb-3">
        {def && usage ? (
          <UsageCardBody
            usage={usage}
            def={def}
            style={instance?.style ?? 'colorful'}
            compact={instance?.size === 'small'}
            mode={mode}
          />
        ) : (
          <UsageCardBodySkeleton compact={instance?.size === 'small'} />
        )}
      </div>
    </div>
  );
}
