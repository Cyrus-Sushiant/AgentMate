import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import type { IconProps } from '@/components/icons';
import {
  Android,
  Blocks,
  ChartColumn,
  Docker,
  FolderKanban,
  Github,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  Plug,
  Rocket,
  Send,
  SettingsIcon,
  Sparkles,
  TerminalSquare,
  Vault,
  Workspace,
  Wrench,
} from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useAgentStatusStore } from '@/stores/agentStatusStore';
import { useUiStore } from '@/stores/uiStore';
import { openUpdateDialog, useUpdateStore } from '@/stores/updateStore';

/** The headed sections of the sidebar, in the order they are shown. */
export const NAV_GROUPS = ['Build', 'Agents', 'Ship', 'Connect'] as const;
type NavGroup = (typeof NAV_GROUPS)[number];

interface NavItem {
  to: string;
  label: string;
  icon: React.ForwardRefExoticComponent<IconProps>;
  end?: boolean;
  /** Extra routes that keep this item highlighted (they have no nav entry of their own). */
  alsoActiveOn?: string[];
  /** The headed section it sits in. Items without one are the top few, above every heading. */
  group?: NavGroup;
}

/** Settings is kept apart from the list and pinned to the bottom of the sidebar. */
const SETTINGS_ITEM: NavItem = { to: '/settings', label: 'Settings', icon: SettingsIcon };

/** Every destination, in sidebar order. The command palette lists them in this order too. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/workspace', label: 'Workspace', icon: Workspace },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  // Prompt History has no nav entry of its own; it stays under Prompt Builder.
  {
    to: '/prompt-builder',
    label: 'Prompt Builder',
    icon: Sparkles,
    alsoActiveOn: ['/prompt-history'],
    group: 'Build',
  },
  { to: '/ask-ai', label: 'Ask AI', icon: MessageSquare, group: 'Build' },
  { to: '/api-client', label: 'API Client', icon: Send, group: 'Build' },
  { to: '/cli-manager', label: 'AI CLI Manager', icon: TerminalSquare, group: 'Agents' },
  { to: '/skills', label: 'Skills', icon: Blocks, group: 'Agents' },
  { to: '/mcp', label: 'MCP Servers', icon: Plug, group: 'Agents' },
  { to: '/tools', label: 'Agent Tools', icon: Wrench, group: 'Agents' },
  { to: '/usage', label: 'Token Usage', icon: ChartColumn, group: 'Agents' },
  { to: '/pipelines', label: 'Pipelines', icon: Github, group: 'Ship' },
  { to: '/deploy', label: 'Deploy', icon: Rocket, group: 'Ship' },
  { to: '/docker', label: 'Docker', icon: Docker, group: 'Ship' },
  { to: '/android', label: 'Android', icon: Android, group: 'Ship' },
  { to: '/remote', label: 'Remote', icon: Monitor, group: 'Connect' },
  { to: '/vault', label: 'Vault', icon: Vault, group: 'Connect' },
  SETTINGS_ITEM,
];

export function Sidebar(): React.JSX.Element {
  const sidebarMode = useUiStore((s) => s.sidebarMode);
  const collapsed = sidebarMode === 'collapsed';
  const hidden = sidebarMode === 'hidden';
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const appVersionQuery = useQuery({
    queryKey: queryKeys.appVersion,
    queryFn: () => window.agentmat.app.getVersion(),
  });
  const unreadQuery = useQuery({
    queryKey: queryKeys.appNotificationUnread,
    queryFn: () => window.agentmat.appNotifications.unreadCount(),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    return window.agentmat.appNotifications.onChanged(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotificationUnread });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appNotifications });
    });
  }, [queryClient]);
  const unread = unreadQuery.data ?? 0;
  const workspaceAttention = useAgentStatusStore((s) => {
    const all = Object.values(s.statuses);
    return all.includes('needs-input') ? 'needs-input' : all.includes('done') ? 'done' : null;
  });
  const checkingForUpdates = useUpdateStore((s) => s.status.state === 'checking');

  /**
   * A check that finds something hands off to UpdateManager's dialog; the quiet
   * outcomes (already current, or the check itself failed) only get a toast.
   */
  async function checkForUpdates(): Promise<void> {
    if (checkingForUpdates) return;
    const result = await window.agentmat.app.checkForUpdates();
    if (result.state === 'not-available') toast.success("You're on the latest version.");
    else if (result.state === 'error') toast.error(result.message);
    else openUpdateDialog();
  }

  const pillTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 32 };

  return (
    <aside
      className={cn(
        'sidebar-gradient flex shrink-0 flex-col overflow-hidden py-3 transition-[width] duration-200',
        hidden ? 'w-0 px-0' : cn('sidebar-panel mb-1.5 ml-2 px-2.5', collapsed ? 'w-16' : 'w-56'),
      )}
      aria-hidden={hidden}
    >
      {!hidden && (
        <LayoutGroup>
          <nav className="rail-scroll flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overflow-x-hidden">
            {NAV_ITEMS.filter((item) => !item.group && item !== SETTINGS_ITEM).map(renderItem)}
            {NAV_GROUPS.map((group) => (
              <div key={group} role="group" aria-label={group} className="flex flex-col gap-px">
                {collapsed ? (
                  <div className="mx-3 my-2 h-px shrink-0 bg-border/60" />
                ) : (
                  <div className="select-none px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                    {group}
                  </div>
                )}
                {NAV_ITEMS.filter((item) => item.group === group).map(renderItem)}
              </div>
            ))}
          </nav>

          <div className="mt-1.5 flex shrink-0 flex-col gap-px border-t border-border/50 pt-1.5">
            {renderItem(SETTINGS_ITEM)}
            {!collapsed && (
              <SimpleTooltip label="Check for updates" side="top" align="start">
                <button
                  type="button"
                  onClick={() => void checkForUpdates()}
                  className="w-full select-none rounded-md px-3 py-1 text-left text-[11px] text-muted-foreground/55 transition-colors hover:bg-foreground/[0.06] hover:text-muted-foreground"
                >
                  AgentMate{' '}
                  {appVersionQuery.data == null
                    ? ''
                    : appVersionQuery.data === 'dev'
                      ? 'dev'
                      : `v${appVersionQuery.data}`}
                  {checkingForUpdates ? ' · checking for updates' : ''}
                </button>
              </SimpleTooltip>
            )}
          </div>
        </LayoutGroup>
      )}
    </aside>
  );

  function renderItem(item: NavItem): React.JSX.Element {
    const activeByAlias =
      item.alsoActiveOn?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false;

    const link = (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn(
            'group relative flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-[5px] text-sm font-medium transition-colors',
            collapsed && 'justify-center px-0',
            isActive || activeByAlias
              ? 'font-semibold text-primary'
              : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
          )
        }
      >
        {({ isActive }) => {
          const active = isActive || activeByAlias;
          return (
            <>
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-primary/12"
                  transition={pillTransition}
                />
              )}
              {active && !collapsed && (
                <span className="absolute left-0 top-1/2 z-10 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]" />
              )}
              <item.icon
                className={cn('relative z-10 h-4 w-4 shrink-0', active && 'text-primary')}
              />
              {!collapsed && <span className="relative z-10">{item.label}</span>}
              {item.to === '/pipelines' && unread > 0 ? (
                collapsed ? (
                  <span className="absolute right-1.5 top-1.5 z-10 h-1.5 w-1.5 rounded-full bg-destructive" />
                ) : (
                  <span className="relative z-10 ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-destructive-foreground">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )
              ) : null}
              {item.to === '/workspace' && workspaceAttention ? (
                <span
                  className={cn(
                    'z-10 h-1.5 w-1.5 rounded-full',
                    collapsed ? 'absolute right-1.5 top-1.5' : 'relative ml-auto',
                    workspaceAttention === 'needs-input'
                      ? 'bg-warning shadow-[0_0_6px_hsl(var(--warning))]'
                      : 'bg-primary shadow-[0_0_6px_hsl(var(--primary))]',
                  )}
                />
              ) : null}
            </>
          );
        }}
      </NavLink>
    );

    return collapsed ? (
      <SimpleTooltip key={item.to} label={item.label} side="right">
        {link}
      </SimpleTooltip>
    ) : (
      link
    );
  }
}
