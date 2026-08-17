import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { IconProps } from '@/components/icons';
import {
  Bell,
  Blocks,
  Broadcast,
  ChartColumn,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Plug,
  SettingsIcon,
  Sparkles,
  TerminalSquare,
  Wrench,
} from '@/components/icons';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';

interface NavItem {
  to: string;
  label: string;
  icon: React.ForwardRefExoticComponent<IconProps>;
  end?: boolean;
  /** Extra routes that keep this item highlighted (they have no nav entry of their own). */
  alsoActiveOn?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/usage', label: 'Token Usage', icon: ChartColumn },
  // Prompt History has no nav entry of its own; it stays under Prompt Builder.
  {
    to: '/prompt-builder',
    label: 'Prompt Builder',
    icon: Sparkles,
    alsoActiveOn: ['/prompt-history'],
  },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/skills', label: 'Skills', icon: Blocks },
  { to: '/mcp', label: 'MCP Servers', icon: Plug },
  { to: '/tools', label: 'Agent Tools', icon: Wrench },
  { to: '/cli-manager', label: 'AI CLI Manager', icon: TerminalSquare },
  { to: '/ask-ai', label: 'Ask AI', icon: MessageSquare },
  { to: '/remote', label: 'Remote', icon: Broadcast },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar(): React.JSX.Element {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
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
  const pillTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 32 };

  return (
    <aside
      className={cn(
        'sidebar-gradient flex h-full shrink-0 flex-col border-r border-border/80 px-2.5 py-3 transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      <LayoutGroup>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const activeByAlias =
              item.alsoActiveOn?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ??
              false;

            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
                      {item.to === '/notifications' && unread > 0 ? (
                        collapsed ? (
                          <span className="absolute right-1.5 top-1.5 z-10 h-1.5 w-1.5 rounded-full bg-destructive" />
                        ) : (
                          <span className="relative z-10 ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-destructive-foreground">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )
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
          })}
        </nav>
      </LayoutGroup>

      {!collapsed && (
        <div className="mt-2 border-t border-border/50 px-2.5 pt-3 text-[11px] text-muted-foreground/55">
          AgentMate{' '}
          {appVersionQuery.data == null
            ? ''
            : appVersionQuery.data === 'dev'
              ? 'dev'
              : `v${appVersionQuery.data}`}
        </div>
      )}
    </aside>
  );
}
