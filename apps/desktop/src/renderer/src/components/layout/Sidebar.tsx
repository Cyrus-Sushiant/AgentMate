import { NavLink } from 'react-router-dom';
import {
  Blocks,
  Broadcast,
  FolderKanban,
  History,
  LayoutDashboard,
  MessageSquare,
  Plug,
  SettingsIcon,
  Sparkles,
  TerminalSquare,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import { SimpleTooltip } from '@/components/ui/tooltip';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/prompt-builder', label: 'Prompt Builder', icon: Sparkles },
  { to: '/prompt-history', label: 'Prompt History', icon: History },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/skills', label: 'Skills', icon: Blocks },
  { to: '/mcp', label: 'MCP Servers', icon: Plug },
  { to: '/cli-manager', label: 'AI CLI Manager', icon: TerminalSquare },
  { to: '/ask-ai', label: 'Ask AI', icon: MessageSquare },
  { to: '/remote', label: 'Remote', icon: Broadcast },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar(): React.JSX.Element {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <aside
      className={cn(
        'sidebar-gradient flex h-full shrink-0 flex-col border-r border-border px-3 py-4 transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-primary/15 font-semibold text-primary'
                    : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
                  {!collapsed && <span>{item.label}</span>}
                </>
              )}
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

      {!collapsed && (
        <div className="px-2.5 pt-2 text-[11px] text-muted-foreground/60">AgentMate v0.1.0</div>
      )}
    </aside>
  );
}
