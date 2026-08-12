import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AskAiModal } from '@/components/askAi/AskAiModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AnglesLeft, AnglesRight, MessageSquare, TerminalSquare } from '@/components/icons';
import { CommandPalette } from '@/components/search/CommandPalette';
import { TerminalDrawer } from '@/components/terminal/TerminalDrawer';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useAppLoadingOverlay } from '@/hooks/useAppLoadingOverlay';
import { cn } from '@/lib/utils';
import { useAskAiStore } from '@/stores/askAiStore';
import { usePageHeaderStore } from '@/stores/pageHeaderStore';
import { useSearchStore } from '@/stores/searchStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useUiStore } from '@/stores/uiStore';
import { LoadingOverlay } from './LoadingOverlay';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';

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
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/80 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <SimpleTooltip label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            {sidebarCollapsed ? (
              <AnglesRight className="h-4 w-4" />
            ) : (
              <AnglesLeft className="h-4 w-4" />
            )}
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
          <span className="hidden max-w-[16rem] truncate text-xs text-muted-foreground sm:inline">
            {activeSession.title}
          </span>
        )}
        <SimpleTooltip label="Toggle terminal (Ctrl+`)">
          <Button
            variant={isTerminalOpen ? 'secondary' : 'ghost'}
            size="icon"
            aria-pressed={isTerminalOpen}
            aria-label="Toggle terminal"
            onClick={toggleDrawer}
            className="relative"
          >
            <TerminalSquare className="h-4 w-4" />
            {sessions.length > 0 && (
              <span
                className={cn(
                  'absolute right-1 top-1 h-1.5 w-1.5 rounded-full',
                  isTerminalOpen
                    ? 'bg-primary shadow-[0_0_6px_hsl(var(--primary))]'
                    : 'bg-primary/70',
                )}
              />
            )}
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Ask AI">
          <Button variant="ghost" size="icon" onClick={openAskAi}>
            <MessageSquare className="h-4 w-4" />
          </Button>
        </SimpleTooltip>
      </div>
    </div>
  );
}

export function AppShell(): React.JSX.Element {
  const location = useLocation();
  // Only the cold start gets the full-page overlay. Every later load shimmers
  // in place on the card that's waiting. See the hook for why.
  const showLoading = useAppLoadingOverlay();
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
              {/* Keyed on the path so React remounts the wrapper per route and
                  the CSS enter animation replays. No exit animation and no
                  AnimatePresence gate: the incoming page renders immediately
                  instead of waiting on the outgoing one's animation to report
                  back, which is what used to strand the content area empty. */}
              <div key={location.pathname} className="page-enter flex min-h-full flex-1 flex-col">
                {/* A page that throws must not take the shell down with it,
                    the sidebar stays usable and the error is readable. */}
                <ErrorBoundary resetKey={location.pathname}>
                  <Outlet />
                </ErrorBoundary>
              </div>
            </div>
            <LoadingOverlay show={showLoading} />
            <TerminalDrawer />
          </div>
        </div>
      </div>
    </div>
  );
}
