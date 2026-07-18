import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import {
  AnglesLeft,
  AnglesRight,
  MessageSquare,
  Moon,
  Sun,
  SunMoon,
  TerminalSquare,
} from '@/components/icons';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { LoadingOverlay } from './LoadingOverlay';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useThemeStore } from '@/stores/themeStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useUiStore } from '@/stores/uiStore';
import { usePageHeaderStore } from '@/stores/pageHeaderStore';
import { useSearchStore } from '@/stores/searchStore';
import { useAskAiStore } from '@/stores/askAiStore';
import { TerminalDrawer } from '@/components/terminal/TerminalDrawer';
import { CommandPalette } from '@/components/search/CommandPalette';
import { AskAiModal } from '@/components/askAi/AskAiModal';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { cn } from '@/lib/utils';

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 14, scale: 0.985, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, scale: 0.985, filter: 'blur(4px)' },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

const THEME_CYCLE = ['light', 'dark', 'system'] as const;
const THEME_ICON = { light: Sun, dark: Moon, system: SunMoon };

function ThemeToggle(): React.JSX.Element {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const Icon = THEME_ICON[theme];

  return (
    <SimpleTooltip label={`Theme: ${theme}`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
          setTheme(next);
        }}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </SimpleTooltip>
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
  const openAskAi = useAskAiStore((s) => s.openModal);

  return (
    <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-3">
      <div className="flex min-w-0 items-center gap-3">
        <SimpleTooltip label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            {sidebarCollapsed ? <AnglesRight className="h-4 w-4" /> : <AnglesLeft className="h-4 w-4" />}
          </Button>
        </SimpleTooltip>
        <div className="flex min-w-0 flex-col justify-center">
          {pageTitle && <span className="truncate text-base font-semibold">{pageTitle}</span>}
          {pageSubtitle && (
            <span className="truncate text-xs text-muted-foreground">{pageSubtitle}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        {activeSession && (
          <span className="max-w-[16rem] truncate text-xs text-muted-foreground">
            {activeSession.title}
          </span>
        )}
        <SimpleTooltip label="Toggle terminal">
          <Button variant={isTerminalOpen ? 'secondary' : 'ghost'} size="icon" onClick={toggleDrawer}>
            <TerminalSquare className="h-4 w-4" />
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Ask AI">
          <Button variant="ghost" size="icon" onClick={openAskAi}>
            <MessageSquare className="h-4 w-4" />
          </Button>
        </SimpleTooltip>
        <ThemeToggle />
      </div>
    </div>
  );
}

export function AppShell(): React.JSX.Element {
  const location = useLocation();
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const showLoading = useDelayedLoading(isFetching + isMutating > 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toggleSearch = useSearchStore((s) => s.toggle);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      // e.code matches the physical key regardless of keyboard layout (e.g. Persian),
      // while e.key keeps non-QWERTY layouts like Dvorak working.
      if ((e.metaKey || e.ctrlKey) && (e.code === 'KeyK' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        toggleSearch();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSearch]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <CommandPalette />
      <AskAiModal />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <TopBar />
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div ref={scrollRef} className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto')}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={PAGE_TRANSITION.initial}
                  animate={PAGE_TRANSITION.animate}
                  exit={PAGE_TRANSITION.exit}
                  transition={PAGE_TRANSITION.transition}
                  className="flex min-h-full flex-1 flex-col"
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
            <LoadingOverlay show={showLoading} />
          </div>
          <TerminalDrawer />
        </div>
      </div>
    </div>
  );
}
