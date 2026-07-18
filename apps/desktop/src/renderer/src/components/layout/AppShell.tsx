import { AnimatePresence, motion } from 'framer-motion';
import { AnglesLeft, AnglesRight, Moon, Sun, SunMoon, TerminalSquare } from '@/components/icons';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/stores/themeStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useUiStore } from '@/stores/uiStore';
import { usePageHeaderStore } from '@/stores/pageHeaderStore';
import { TerminalDrawer } from '@/components/terminal/TerminalDrawer';
import { cn } from '@/lib/utils';

const THEME_CYCLE = ['light', 'dark', 'system'] as const;
const THEME_ICON = { light: Sun, dark: Moon, system: SunMoon };

function ThemeToggle(): React.JSX.Element {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const Icon = THEME_ICON[theme];

  return (
    <Button
      variant="ghost"
      size="icon"
      title={`Theme: ${theme}`}
      onClick={() => {
        const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
        setTheme(next);
      }}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function TopBar(): React.JSX.Element {
  const isTerminalOpen = useTerminalStore((s) => s.isOpen);
  const toggleDrawer = useTerminalStore((s) => s.toggleDrawer);
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const pageTitle = usePageHeaderStore((s) => s.title);
  const pageSubtitle = usePageHeaderStore((s) => s.subtitle);

  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-3">
      <Button
        variant="ghost"
        size="icon"
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={toggleSidebar}
      >
        {sidebarCollapsed ? <AnglesRight className="h-4 w-4" /> : <AnglesLeft className="h-4 w-4" />}
      </Button>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {pageTitle && <span className="truncate text-base font-semibold">{pageTitle}</span>}
        {pageSubtitle && (
          <span className="truncate text-xs text-muted-foreground">{pageSubtitle}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {activeSession && (
          <span className="max-w-[16rem] truncate text-xs text-muted-foreground">
            {activeSession.title}
          </span>
        )}
        <Button
          variant={isTerminalOpen ? 'secondary' : 'ghost'}
          size="icon"
          title="Toggle terminal"
          onClick={toggleDrawer}
        >
          <TerminalSquare className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );
}

export function AppShell(): React.JSX.Element {
  const location = useLocation();

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <TopBar />
          <div className={cn('relative flex min-h-0 flex-1 flex-col overflow-y-auto')}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="flex min-h-full flex-1 flex-col"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
          <TerminalDrawer />
        </div>
      </div>
    </div>
  );
}
