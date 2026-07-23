import { useState } from 'react';
import { Plus, WindowMaximize, WindowRestore, X } from '@/components/icons';
import { useTerminalStore } from '@/stores/terminalStore';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TerminalPane } from './TerminalPane';

export function TerminalDrawer(): React.JSX.Element | null {
  const isOpen = useTerminalStore((s) => s.isOpen);
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const closeSession = useTerminalStore((s) => s.closeSession);
  const openSession = useTerminalStore((s) => s.openSession);
  const closeDrawer = useTerminalStore((s) => s.closeDrawer);
  const [isMaximized, setIsMaximized] = useState(false);

  if (!isOpen) return null;

  function handleCloseDrawer(): void {
    setIsMaximized(false);
    closeDrawer();
  }

  function handleNewPowerShell(): void {
    const count = sessions.filter((s) => s.shell === 'powershell.exe').length;
    openSession({
      title: count === 0 ? 'PowerShell' : `PowerShell ${count + 1}`,
      shell: 'powershell.exe',
    });
  }

  return (
    <div
      className={cn(
        'flex flex-col border-t border-border bg-black/60 backdrop-blur-2xl',
        isMaximized
          ? 'fixed inset-x-0 bottom-0 top-11 z-50 h-auto'
          : 'absolute inset-x-0 bottom-0 z-20 h-72',
      )}
    >
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1">
        {sessions.length === 0 ? (
          <span className="px-2 py-1 text-xs text-white/50">
            No terminal sessions. Install a CLI or open one from a project.
          </span>
        ) : (
          sessions.map((session) => (
            <SimpleTooltip key={session.id} label={session.title}>
              <button
                onClick={() => setActiveSession(session.id)}
                onMouseDown={(e) => {
                  // Prevent the middle-click autoscroll cursor from appearing.
                  if (e.button === 1) e.preventDefault();
                }}
                onAuxClick={(e) => {
                  // Middle-click (mouse wheel button) closes the tab, like browsers.
                  if (e.button === 1) {
                    e.preventDefault();
                    closeSession(session.id);
                  }
                }}
                className={cn(
                  'group flex items-center gap-2 rounded-t-md px-3 py-1.5 text-xs',
                  session.id === activeSessionId
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white/80',
                )}
              >
                <span className="max-w-[10rem] truncate">{session.title}</span>
                <X
                  className="h-3 w-3 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeSession(session.id);
                  }}
                />
              </button>
            </SimpleTooltip>
          ))
        )}
        <SimpleTooltip label="New PowerShell terminal">
          <button
            onClick={handleNewPowerShell}
            className="flex items-center rounded-t-md px-2 py-1.5 text-white/50 hover:text-white/80"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </SimpleTooltip>
        <div className="flex-1" />
        <SimpleTooltip label={isMaximized ? 'Restore terminal' : 'Maximize terminal'}>
          <button
            onClick={() => setIsMaximized((v) => !v)}
            className="flex items-center rounded-t-md px-2 py-1.5 text-white/50 hover:text-white/80"
          >
            {isMaximized ? (
              <WindowRestore className="h-3.5 w-3.5" />
            ) : (
              <WindowMaximize className="h-3.5 w-3.5" />
            )}
          </button>
        </SimpleTooltip>
        <SimpleTooltip label="Close terminal panel">
          <button
            onClick={handleCloseDrawer}
            className="flex items-center rounded-t-md px-2 py-1.5 text-white/50 hover:text-white/80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </SimpleTooltip>
      </div>
      <div className="relative min-h-0 flex-1">
        {sessions.map((session) => (
          <TerminalPane
            key={session.id}
            meta={session}
            active={session.id === activeSessionId}
            onExit={() => closeSession(session.id)}
          />
        ))}
      </div>
    </div>
  );
}
