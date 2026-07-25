import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  USAGE_PROVIDER_REGISTRY,
  getUsageProvider,
  type ProviderUsage,
  type UsageProviderConfig,
} from '@agentmat/core';
import { Bolt, ChartColumn, GripVertical, Pin, Plus, RefreshCw, X } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { ProviderLogo } from '@/components/providerLogos';
import { UsageCardBody } from '@/components/usage/UsageCard';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { formatCost, formatTokens } from '@/lib/usageFormat';
import { usePageHeader } from '@/stores/pageHeaderStore';

const USAGE_LIST_KEY = ['usage-list'] as const;

function isDisplayed(id: string, configs: Record<string, UsageProviderConfig>): boolean {
  const def = getUsageProvider(id);
  if (!def) return false;
  if (def.dataSource === 'local-log') return true;
  return !!configs[id]?.enabled;
}

/** Keep saved order, drop stale ids, append newly-enabled providers. */
function orderedProviderIds(
  savedOrder: string[],
  configs: Record<string, UsageProviderConfig>,
): string[] {
  const all = USAGE_PROVIDER_REGISTRY.filter((d) => isDisplayed(d.id, configs)).map((d) => d.id);
  const known = new Set(all);
  const kept = savedOrder.filter((id) => known.has(id));
  const missing = all.filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

export default function UsagePage(): React.JSX.Element {
  usePageHeader('Token Usage', 'Track tokens, cost, and limits across your AI providers.');
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
  });
  const usageQuery = useQuery({
    queryKey: USAGE_LIST_KEY,
    queryFn: () => window.agentmat.usage.list(),
    refetchInterval: 45_000,
  });

  const settings = settingsQuery.data;
  const configs = settings?.usageProviderConfigs ?? {};
  const displayedIds = useMemo(
    () => orderedProviderIds(settings?.usageCardOrder ?? [], settings?.usageProviderConfigs ?? {}),
    [settings],
  );

  const usageById = useMemo(() => {
    const map = new Map<string, ProviderUsage>();
    for (const u of usageQuery.data ?? []) map.set(u.providerId, u);
    return map;
  }, [usageQuery.data]);

  const totals = useMemo(() => {
    let todayTokens = 0;
    let weekTokens = 0;
    let cost = 0;
    for (const id of displayedIds) {
      const u = usageById.get(id);
      if (!u || u.status !== 'ok') continue;
      todayTokens += u.today.tokens.total;
      weekTokens += u.last7d.tokens.total;
      cost += u.today.costUsd ?? 0;
    }
    return { todayTokens, weekTokens, cost };
  }, [displayedIds, usageById]);

  async function persistOrder(next: string[]): Promise<void> {
    await window.agentmat.settings.update({ usageCardOrder: next });
    await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
  }

  function handleDrop(targetId: string): void {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const next = displayedIds.filter((id) => id !== dragId);
    next.splice(next.indexOf(targetId), 0, dragId);
    setDragId(null);
    void persistOrder(next);
  }

  async function setConfig(providerId: string, config: UsageProviderConfig): Promise<void> {
    await window.agentmat.usage.setProviderConfig(providerId, config);
    await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    await queryClient.invalidateQueries({ queryKey: USAGE_LIST_KEY });
  }

  async function popOut(providerId: string): Promise<void> {
    try {
      await window.agentmat.usage.openWidget(providerId);
      toast.success(`${getUsageProvider(providerId)?.name} widget added to your desktop.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the widget to your desktop.');
    }
  }

  async function refreshAll(): Promise<void> {
    await window.agentmat.usage.refresh();
    await queryClient.invalidateQueries({ queryKey: USAGE_LIST_KEY });
    toast.info('Refreshing usage…');
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAddOpen(true)}>
          <Plus /> Add provider
        </Button>
        <Button variant="outline" onClick={() => void refreshAll()}>
          <RefreshCw className={usageQuery.isFetching ? 'animate-spin' : undefined} /> Refresh
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile icon={<ChartColumn className="h-3.5 w-3.5" />} label="Tokens today" value={formatTokens(totals.todayTokens)} />
        <StatTile icon={<Bolt className="h-3.5 w-3.5" />} label="Tokens (7 days)" value={formatTokens(totals.weekTokens)} />
        <StatTile icon={<ChartColumn className="h-3.5 w-3.5" />} label="Cost today" value={formatCost(totals.cost) ?? '$0.00'} />
        <StatTile icon={<Pin className="h-3.5 w-3.5" />} label="Providers tracked" value={`${displayedIds.length}/${USAGE_PROVIDER_REGISTRY.length}`} />
      </div>

      {/* Provider cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {displayedIds.map((id) => {
          const def = getUsageProvider(id);
          if (!def) return null;
          const usage = usageById.get(id);
          const removable = def.dataSource !== 'local-log';
          return (
            <motion.div key={id} layout transition={{ type: 'spring', stiffness: 400, damping: 35 }}>
              <Card
                className={cn('glass h-full', dragId === id && 'opacity-50')}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(id)}
              >
                <CardContent className="flex h-full flex-col p-4">
                  <div className="mb-2 flex items-center gap-1">
                    <div className="mr-auto flex min-w-0 items-center gap-2">
                      <ProviderLogo providerId={id} className="h-5 w-5 shrink-0" />
                      <span className="truncate text-sm font-semibold">{def.name}</span>
                    </div>
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(id);
                      }}
                      className="cursor-grab text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
                      title="Drag to reorder"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                    <SimpleTooltip label="Add to desktop">
                      <Button variant="ghost" size="icon" onClick={() => void popOut(id)}>
                        <Pin className="h-3.5 w-3.5" />
                      </Button>
                    </SimpleTooltip>
                    {removable && (
                      <SimpleTooltip label="Remove">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void setConfig(id, { ...configs[id], enabled: false })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </SimpleTooltip>
                    )}
                  </div>
                  {usage ? (
                    <UsageCardBody usage={usage} def={def} hideHeader />
                  ) : (
                    <div className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
                      <span className={usageQuery.isError ? 'text-destructive' : undefined}>
                        {usageQuery.isError
                          ? (usageQuery.error as Error).message
                          : def.dataSource === 'local-log'
                            ? 'scanning local logs…'
                            : 'loading…'}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <AddProviderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        configs={configs}
        onSave={setConfig}
      />
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <Card className="glass">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon} {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function AddProviderDialog({
  open,
  onOpenChange,
  configs,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configs: Record<string, UsageProviderConfig>;
  onSave: (providerId: string, config: UsageProviderConfig) => Promise<void>;
}): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [keys, setKeys] = useState<Record<string, string>>({});

  const filtered = USAGE_PROVIDER_REGISTRY.filter((d) =>
    d.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a provider</DialogTitle>
          <DialogDescription>
            Claude Code and Codex are tracked automatically from local logs. API providers need a
            key; the rest are registered and coming soon.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search 63 providers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((def) => {
            const enabled = def.dataSource === 'local-log' || configs[def.id]?.enabled;
            const isApi = def.dataSource === 'api-key';
            const unsupported = def.dataSource === 'unsupported';
            return (
              <div
                key={def.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2"
              >
                <ProviderLogo providerId={def.id} className="h-6 w-6" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{def.name}</span>
                    <Badge variant="outline" className="capitalize">
                      {def.category.replace('-', ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {def.dataSource === 'local-log'
                      ? 'Local logs · automatic'
                      : isApi
                        ? 'API key'
                        : 'Coming soon'}
                  </div>
                </div>
                {isApi &&
                  (enabled ? (
                    <Badge variant="success">Added</Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="password"
                        placeholder="API key"
                        value={keys[def.id] ?? ''}
                        onChange={(e) => setKeys((k) => ({ ...k, [def.id]: e.target.value }))}
                        className="h-8 w-40"
                      />
                      <Button
                        size="sm"
                        disabled={!keys[def.id]}
                        onClick={() =>
                          void onSave(def.id, { enabled: true, apiKey: keys[def.id] ?? null })
                        }
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                {def.dataSource === 'local-log' && <Badge variant="success">Auto</Badge>}
                {unsupported && <Badge variant="outline">Soon</Badge>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
