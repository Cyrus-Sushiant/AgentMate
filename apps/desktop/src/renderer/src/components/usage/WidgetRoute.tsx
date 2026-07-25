import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getUsageProvider } from '@agentmat/core';
import { X } from '@/components/icons';
import { UsageCardBody } from './UsageCard';

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

  return (
    <div className="glass flex h-screen w-screen flex-col overflow-hidden rounded-2xl">
      <div className="widget-drag flex h-6 shrink-0 items-center justify-end px-2">
        <button
          className="widget-no-drag flex h-5 w-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground"
          title="Close widget"
          onClick={() => void window.agentmat.usage.closeWidget(id)}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="min-h-0 flex-1 px-3 pb-3">
        {def && usageQuery.data ? (
          <UsageCardBody
            usage={usageQuery.data}
            def={def}
            style={instance?.style ?? 'colorful'}
            compact={instance?.size === 'small'}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}
