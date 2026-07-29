import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  FABLE_WEEK_LABEL,
  USAGE_PROVIDER_REGISTRY,
  getUsageProvider,
  isAutoConnected,
  normalizeUsageResetAlerts,
  normalizeUsageThresholdAlerts,
  type ProviderUsage,
  type SubscriptionWindowKey,
  type UsageProviderConfig,
  type UsageResetAlertSettings,
  type UsageThresholdAlertSettings,
  type WidgetMode,
} from '@agentmat/core';
import {
  Bell,
  Bolt,
  ChartColumn,
  Check,
  Clock,
  GripVertical,
  LayoutDashboard,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Send,
  TriangleAlert,
  X,
} from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { ProviderLogo } from '@/components/providerLogos';
import { Skeleton } from '@/components/ui/skeleton';
import {
  UsageCardBody,
  UsageCardBodySkeleton,
  hasSubscriptionView,
} from '@/components/usage/UsageCard';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { formatCost, formatReset, formatTokens } from '@/lib/usageFormat';
import { usePageHeader } from '@/stores/pageHeaderStore';
import { useDashboardLayoutStore } from '@/stores/dashboardLayoutStore';

function isDisplayed(id: string, configs: Record<string, UsageProviderConfig>): boolean {
  const def = getUsageProvider(id);
  if (!def) return false;
  if (isAutoConnected(def)) return true;
  return !!configs[id]?.enabled;
}

/** Keep saved order, drop stale ids, append newly-enabled providers. */
function orderedProviderIds(
  savedOrder: string[],
  configs: Record<string, UsageProviderConfig>,
): string[] {
  const all = USAGE_PROVIDER_REGISTRY.filter((d) => isDisplayed(d.id, configs)).map((d) => d.id);
  const known = new Set(all);
  // A saved order repeating an id (an interrupted write, an older build) would
  // render two cards under the same React key. Deduped here so the list stays
  // a set of provider ids whatever is on disk.
  const kept = [...new Set(savedOrder.filter((id) => known.has(id)))];
  const missing = all.filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

export default function UsagePage(): React.JSX.Element {
  usePageHeader('Token Usage', 'Track tokens, cost, and limits across your AI providers.');
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [thresholdAlertsOpen, setThresholdAlertsOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  // Off by default so the drag handle doesn't clutter the everyday view, same
  // pattern as the Dashboard's layout-edit mode.
  const [editing, setEditing] = useState(false);

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
  });
  const usageQuery = useQuery({
    queryKey: queryKeys.usageList,
    queryFn: () => window.agentmat.usage.list(),
    refetchInterval: 45_000,
  });

  const dashboardCards = useDashboardLayoutStore((s) => s.usageCards);
  const toggleDashboardCard = useDashboardLayoutStore((s) => s.toggleUsageCard);
  const dashboardSummaryCards = useDashboardLayoutStore((s) => s.summaryCards);
  const toggleDashboardSummaryCard = useDashboardLayoutStore((s) => s.toggleSummaryCard);

  const settings = settingsQuery.data;
  const configs = settings?.usageProviderConfigs ?? {};
  const cardModes = settings?.usageCardModes ?? {};
  const resetAlerts = normalizeUsageResetAlerts(settings?.usageResetAlerts);
  const thresholdAlerts = normalizeUsageThresholdAlerts(settings?.usageThresholdAlerts);
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

  /** Soonest rollover among the watched windows; what the switch counts down to. */
  const nextReset = useMemo(() => {
    const windows = usageById.get(resetAlerts.providerId)?.subscription?.windows ?? [];
    return windows
      .filter((w) => resetAlerts.windows.includes(w.key) && w.resetAt)
      .sort((a, b) => Date.parse(a.resetAt!) - Date.parse(b.resetAt!))[0];
  }, [usageById, resetAlerts.providerId, resetAlerts.windows]);

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
    // A provider that's no longer tracked can't feed a dashboard card either.
    if (!config.enabled && dashboardCards.includes(providerId)) toggleDashboardCard(providerId);
    await window.agentmat.usage.setProviderConfig(providerId, config);
    await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    await queryClient.invalidateQueries({ queryKey: queryKeys.usageList });
  }

  /** Adds/removes this provider's card on the Dashboard page. */
  function toggleDashboard(providerId: string): void {
    const name = getUsageProvider(providerId)?.name ?? 'Card';
    const added = toggleDashboardCard(providerId);
    if (added) toast.success(`${name} added to your dashboard.`);
    else toast.info(`${name} removed from your dashboard.`);
  }

  /** Adds/removes one of the summary tiles above on the Dashboard page. */
  function toggleSummaryDashboard(id: 'tokens-today' | 'tokens-week' | 'cost-today' | 'providers-tracked', label: string): void {
    const added = toggleDashboardSummaryCard(id);
    if (added) toast.success(`${label} added to your dashboard.`);
    else toast.info(`${label} removed from your dashboard.`);
  }

  /** The pin button each summary tile shows, mirroring the provider cards' dashboard toggle. */
  function summaryPinAction(
    id: 'tokens-today' | 'tokens-week' | 'cost-today' | 'providers-tracked',
    label: string,
  ): React.ReactNode {
    const pinned = dashboardSummaryCards.includes(id);
    return (
      <SimpleTooltip label={pinned ? 'Remove from dashboard' : 'Add to dashboard'}>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-5 w-5', pinned && 'text-primary')}
          onClick={() => toggleSummaryDashboard(id, label)}
        >
          <LayoutDashboard className="h-3 w-3" />
        </Button>
      </SimpleTooltip>
    );
  }

  /** Pins whichever view the card is currently showing. */
  async function popOut(providerId: string): Promise<void> {
    const name = getUsageProvider(providerId)?.name;
    const mode = cardModes[providerId] ?? 'tokens';
    const label = mode === 'subscription' ? `${name} plan limits` : name;
    try {
      await window.agentmat.usage.openWidget(providerId, undefined, mode);
      toast.success(`${label} widget added to your desktop.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the widget to your desktop.');
    }
  }

  /** Flip one card between the tokens view and the plan-limits view. */
  async function toggleCardMode(providerId: string): Promise<void> {
    const next: WidgetMode = cardModes[providerId] === 'subscription' ? 'tokens' : 'subscription';
    await window.agentmat.settings.update({
      usageCardModes: { ...cardModes, [providerId]: next },
    });
    await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
  }

  async function refreshAll(): Promise<void> {
    await window.agentmat.usage.refresh();
    await queryClient.invalidateQueries({ queryKey: queryKeys.usageList });
    toast.info('Refreshing usage…');
  }

  async function saveResetAlerts(next: UsageResetAlertSettings): Promise<void> {
    await window.agentmat.usage.setResetAlerts(next);
    await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
  }

  /** The switch inside the reset-alert dialog, opened from the provider's card. */
  async function toggleResetAlerts(enabled: boolean): Promise<void> {
    await saveResetAlerts({ ...resetAlerts, enabled });
    if (!enabled) {
      toast.info('Reset alerts turned off.');
      return;
    }
    // Nothing can be delivered without a bot, so say so at the moment it matters
    // rather than letting the switch sit on and silently do nothing.
    if (!settings?.telegramBotToken || !(resetAlerts.chatId ?? settings?.telegramChatId)) {
      toast.warning('Add your Telegram bot token and chat ID in Settings to receive these.');
      return;
    }
    toast.success('You will get a Telegram message when the window resets.');
  }

  async function saveThresholdAlerts(next: UsageThresholdAlertSettings): Promise<void> {
    await window.agentmat.usage.setThresholdAlerts(next);
    await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
  }

  /** The switch inside the threshold-alert dialog, opened from the provider's card. */
  async function toggleThresholdAlerts(enabled: boolean): Promise<void> {
    await saveThresholdAlerts({ ...thresholdAlerts, enabled });
    if (!enabled) {
      toast.info('Threshold alerts turned off.');
      return;
    }
    toast.success(
      `You'll get a notification at ${thresholdAlerts.threshold}% usage.`,
    );
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
        <SimpleTooltip label={editing ? 'Done editing' : 'Edit card order'}>
          <Button
            variant={editing ? 'default' : 'outline'}
            size="icon"
            className="ml-auto"
            aria-label={editing ? 'Done editing' : 'Edit card order'}
            onClick={() => setEditing(!editing)}
          >
            {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
        </SimpleTooltip>
      </div>

      {/* Summary tiles: each waits on its own query rather than the page. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          icon={<ChartColumn className="h-3.5 w-3.5" />}
          label="Tokens today"
          action={summaryPinAction('tokens-today', 'Tokens today')}
          value={
            usageQuery.isPending ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              formatTokens(totals.todayTokens)
            )
          }
        />
        <StatTile
          icon={<Bolt className="h-3.5 w-3.5" />}
          label="Tokens (7 days)"
          action={summaryPinAction('tokens-week', 'Tokens (7 days)')}
          value={
            usageQuery.isPending ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              formatTokens(totals.weekTokens)
            )
          }
        />
        <StatTile
          icon={<ChartColumn className="h-3.5 w-3.5" />}
          label="Cost today"
          action={summaryPinAction('cost-today', 'Cost today')}
          value={
            usageQuery.isPending ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              (formatCost(totals.cost) ?? '$0.00')
            )
          }
        />
        <StatTile
          icon={<Pin className="h-3.5 w-3.5" />}
          label="Providers tracked"
          action={summaryPinAction('providers-tracked', 'Providers tracked')}
          value={
            settingsQuery.isPending ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              `${displayedIds.length}/${USAGE_PROVIDER_REGISTRY.length}`
            )
          }
        />
      </div>

      {/* Provider cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* Which providers are tracked comes from settings, so until those land
            there are no cards to shimmer individually, so stand in for a few. */}
        {settingsQuery.isPending &&
          Array.from({ length: 3 }, (_, i) => (
            <Card key={`placeholder-${i}`} className="glass h-full">
              <CardContent className="flex h-full flex-col p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <UsageCardBodySkeleton />
              </CardContent>
            </Card>
          ))}
        {displayedIds.map((id) => {
          const def = getUsageProvider(id);
          if (!def) return null;
          const usage = usageById.get(id);
          const removable = !isAutoConnected(def);
          const cardMode = cardModes[id] ?? 'tokens';
          const onDashboard = dashboardCards.includes(id);
          // Reset alerts watch one provider's rolling windows, so the control
          // belongs on that provider's card rather than in the page toolbar.
          const ownsResetAlerts = id === resetAlerts.providerId;
          const ownsThresholdAlerts = id === thresholdAlerts.providerId;
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
                      {/* The body hides its own header here, so the plan badge
                          rides along with the title, plan-limits view only. */}
                      {cardMode === 'subscription' && usage?.subscription?.plan && (
                        <Badge variant="outline" className="shrink-0">
                          {usage.subscription.plan.label}
                        </Badge>
                      )}
                    </div>
                    {editing && (
                      <SimpleTooltip label="Drag to reorder">
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            setDragId(id);
                          }}
                          className="cursor-grab text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                      </SimpleTooltip>
                    )}
                    {ownsResetAlerts && (
                      <SimpleTooltip
                        label={
                          resetAlerts.enabled
                            ? `Telegram reset alert · on${
                                nextReset ? ` · ${formatReset(nextReset.resetAt) ?? 'idle'}` : ''
                              }`
                            : 'Telegram reset alert · off'
                        }
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!settings}
                          className={resetAlerts.enabled ? 'text-primary' : undefined}
                          onClick={() => setAlertsOpen(true)}
                        >
                          <Bell className="h-3.5 w-3.5" />
                        </Button>
                      </SimpleTooltip>
                    )}
                    {ownsThresholdAlerts && (
                      <SimpleTooltip
                        label={
                          thresholdAlerts.enabled
                            ? `Usage threshold alert · on · ${thresholdAlerts.threshold}%`
                            : 'Usage threshold alert · off'
                        }
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!settings}
                          className={thresholdAlerts.enabled ? 'text-primary' : undefined}
                          onClick={() => setThresholdAlertsOpen(true)}
                        >
                          <TriangleAlert className="h-3.5 w-3.5" />
                        </Button>
                      </SimpleTooltip>
                    )}
                    {/* Switches this card between tokens and plan limits in place;
                        the pin below then pins whichever view is showing. */}
                    {usage && hasSubscriptionView(usage) && (
                      <SimpleTooltip
                        label={
                          cardMode === 'subscription' ? 'Show tokens and cost' : 'Show plan limits'
                        }
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void toggleCardMode(id)}
                        >
                          {cardMode === 'subscription' ? (
                            <ChartColumn className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </SimpleTooltip>
                    )}
                    {/* Same card, shown on the Dashboard page alongside the
                        system charts. It follows this card's tokens/limits view. */}
                    <SimpleTooltip
                      label={
                        onDashboard ? 'Remove from dashboard' : 'Add to dashboard'
                      }
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className={onDashboard ? 'text-primary' : undefined}
                        onClick={() => toggleDashboard(id)}
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" />
                      </Button>
                    </SimpleTooltip>
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
                    <UsageCardBody usage={usage} def={def} hideHeader mode={cardMode} />
                  ) : usageQuery.isError ? (
                    <div className="flex flex-1 items-center gap-2 text-sm text-destructive">
                      {(usageQuery.error as Error).message}
                    </div>
                  ) : (
                    <UsageCardBodySkeleton />
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

      <ResetAlertDialog
        open={alertsOpen}
        onOpenChange={setAlertsOpen}
        alerts={resetAlerts}
        usage={usageById.get(resetAlerts.providerId)}
        fallbackChatId={settings?.telegramChatId ?? null}
        nextResetAt={nextReset?.resetAt}
        onSave={saveResetAlerts}
        onToggle={toggleResetAlerts}
      />

      <ThresholdAlertDialog
        open={thresholdAlertsOpen}
        onOpenChange={setThresholdAlertsOpen}
        alerts={thresholdAlerts}
        usage={usageById.get(thresholdAlerts.providerId)}
        onSave={saveThresholdAlerts}
        onToggle={toggleThresholdAlerts}
      />
    </div>
  );
}

/** Windows that can be announced, in the order the card shows them. */
const RESET_WINDOW_OPTIONS: { key: SubscriptionWindowKey; label: string; hint: string }[] = [
  { key: 'session', label: 'Session (5h)', hint: 'The 5-hour block, the one most people wait on' },
  { key: 'week', label: 'Weekly', hint: 'The rolling 7-day limit' },
  {
    key: 'week-fable',
    label: FABLE_WEEK_LABEL,
    hint: 'Only above Pro, where Fable has its own weekly bucket',
  },
];

function ResetAlertDialog({
  open,
  onOpenChange,
  alerts,
  usage,
  fallbackChatId,
  nextResetAt,
  onSave,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: UsageResetAlertSettings;
  usage: ProviderUsage | undefined;
  fallbackChatId: string | null;
  /** Soonest watched rollover, so the switch says what it is counting down to. */
  nextResetAt: string | null | undefined;
  onSave: (next: UsageResetAlertSettings) => Promise<void>;
  onToggle: (enabled: boolean) => Promise<void>;
}): React.JSX.Element {
  const [chatId, setChatId] = useState(alerts.chatId ?? '');
  const [testing, setTesting] = useState(false);
  const providerName = getUsageProvider(alerts.providerId)?.name ?? alerts.providerId;
  const reported = new Set(usage?.subscription?.windows?.map((w) => w.key));

  function toggleWindow(key: SubscriptionWindowKey): void {
    const next = alerts.windows.includes(key)
      ? alerts.windows.filter((k) => k !== key)
      : [...alerts.windows, key];
    void onSave({ ...alerts, windows: next });
  }

  async function sendTest(): Promise<void> {
    setTesting(true);
    try {
      // Save first so the test uses the chat ID that's on screen, not the saved one.
      await onSave({ ...alerts, chatId: chatId.trim() || null });
      const result = await window.agentmat.usage.testResetAlert();
      if (result.ok) toast.success('Test alert sent. Check Telegram.');
      else toast.error(result.error ?? 'Could not send the test alert.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset alerts</DialogTitle>
          <DialogDescription>
            {providerName} meters you in rolling windows. When one rolls over, your Telegram bot
            gets a message. No schedule to set, the reset time comes from the plan itself.
          </DialogDescription>
        </DialogHeader>

        {/* The on/off switch lives here now, next to what it turns on, instead of
            sitting in the page toolbar away from the provider it watches. */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2">
          <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <Label htmlFor="usage-reset-alerts" className="cursor-pointer text-sm font-medium">
              Telegram reset alert
            </Label>
            <div className="text-xs text-muted-foreground">
              {alerts.enabled
                ? nextResetAt
                  ? `Next message in ${formatReset(nextResetAt) ?? 'a while'}`
                  : 'Idle: no window is counting down right now'
                : 'Off: no message is sent when a window rolls over'}
            </div>
          </div>
          <Switch
            id="usage-reset-alerts"
            checked={alerts.enabled}
            onCheckedChange={(checked) => void onToggle(checked)}
          />
        </div>

        <div className={cn('space-y-2', !alerts.enabled && 'opacity-60')}>
          {RESET_WINDOW_OPTIONS.map((option) => {
            const unavailable = usage != null && !reported.has(option.key);
            return (
              <div
                key={option.key}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <Label
                    htmlFor={`reset-window-${option.key}`}
                    className="cursor-pointer text-sm font-medium"
                  >
                    {option.label}
                  </Label>
                  <div className="text-xs text-muted-foreground">
                    {unavailable ? 'Your plan does not report this window' : option.hint}
                  </div>
                </div>
                <Switch
                  id={`reset-window-${option.key}`}
                  checked={alerts.windows.includes(option.key)}
                  onCheckedChange={() => toggleWindow(option.key)}
                />
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reset-alert-chat-id">Chat/group ID</Label>
          <Input
            id="reset-alert-chat-id"
            placeholder={fallbackChatId ?? 'Uses the chat ID from Settings'}
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            onBlur={() => void onSave({ ...alerts, chatId: chatId.trim() || null })}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to reuse the notification chat from Settings. The bot token always comes
            from there.
          </p>
        </div>

        <Button variant="outline" disabled={testing} onClick={() => void sendTest()}>
          <Send className="h-3.5 w-3.5" /> {testing ? 'Sending…' : 'Send a test alert'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function ThresholdAlertDialog({
  open,
  onOpenChange,
  alerts,
  usage,
  onSave,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: UsageThresholdAlertSettings;
  usage: ProviderUsage | undefined;
  onSave: (next: UsageThresholdAlertSettings) => Promise<void>;
  onToggle: (enabled: boolean) => Promise<void>;
}): React.JSX.Element {
  const [threshold, setThreshold] = useState(String(alerts.threshold));
  const [testing, setTesting] = useState(false);
  const providerName = getUsageProvider(alerts.providerId)?.name ?? alerts.providerId;
  const reported = new Set(usage?.subscription?.windows?.map((w) => w.key));

  function toggleWindow(key: SubscriptionWindowKey): void {
    const next = alerts.windows.includes(key)
      ? alerts.windows.filter((k) => k !== key)
      : [...alerts.windows, key];
    void onSave({ ...alerts, windows: next });
  }

  function commitThreshold(): void {
    const parsed = Number(threshold);
    const clamped = Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.round(parsed))) : alerts.threshold;
    setThreshold(String(clamped));
    if (clamped !== alerts.threshold) void onSave({ ...alerts, threshold: clamped });
  }

  async function sendTest(): Promise<void> {
    setTesting(true);
    try {
      const result = await window.agentmat.usage.testThresholdAlert();
      if (result.ok) toast.success('Test alert sent. Check for an OS notification.');
      else toast.error(result.error ?? 'Could not send the test alert.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usage threshold alert</DialogTitle>
          <DialogDescription>
            Get notified the moment {providerName} crosses a usage percentage you pick: an OS
            notification where supported, or an in-app alert otherwise.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2">
          <TriangleAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <Label htmlFor="usage-threshold-alerts" className="cursor-pointer text-sm font-medium">
              Notify at threshold
            </Label>
            <div className="text-xs text-muted-foreground">
              {alerts.enabled
                ? `Fires once when a watched window reaches ${alerts.threshold}%`
                : 'Off: no notification is sent as usage climbs'}
            </div>
          </div>
          <Switch
            id="usage-threshold-alerts"
            checked={alerts.enabled}
            onCheckedChange={(checked) => void onToggle(checked)}
          />
        </div>

        <div className={cn('space-y-1.5', !alerts.enabled && 'opacity-60')}>
          <Label htmlFor="usage-threshold-value">Threshold (%)</Label>
          <Input
            id="usage-threshold-value"
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            onBlur={commitThreshold}
            className="w-24"
          />
        </div>

        <div className={cn('space-y-2', !alerts.enabled && 'opacity-60')}>
          {RESET_WINDOW_OPTIONS.map((option) => {
            const unavailable = usage != null && !reported.has(option.key);
            return (
              <div
                key={option.key}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <Label
                    htmlFor={`threshold-window-${option.key}`}
                    className="cursor-pointer text-sm font-medium"
                  >
                    {option.label}
                  </Label>
                  <div className="text-xs text-muted-foreground">
                    {unavailable ? 'Your plan does not report this window' : option.hint}
                  </div>
                </div>
                <Switch
                  id={`threshold-window-${option.key}`}
                  checked={alerts.windows.includes(option.key)}
                  onCheckedChange={() => toggleWindow(option.key)}
                />
              </div>
            );
          })}
        </div>

        <Button variant="outline" disabled={testing} onClick={() => void sendTest()}>
          <Send className="h-3.5 w-3.5" /> {testing ? 'Sending…' : 'Send a test alert'}
        </Button>
      </DialogContent>
    </Dialog>
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
            const enabled = isAutoConnected(def) || configs[def.id]?.enabled;
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
                      : def.dataSource === 'local-session'
                        ? 'Signed-in app · automatic'
                        : isApi
                          ? (def.keyHint ?? 'API key')
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
                        placeholder={def.keyHint ?? 'API key'}
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
                {isAutoConnected(def) && <Badge variant="success">Auto</Badge>}
                {unsupported && <Badge variant="outline">Soon</Badge>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
