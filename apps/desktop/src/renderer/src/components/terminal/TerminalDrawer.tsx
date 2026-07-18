import { X } from '@/components/icons';
import { useTerminalStore } from '@/stores/terminalStore';
import { cn } from '@/lib/utils';
import { TerminalPane } from './TerminalPane';

export function TerminalDrawer(): React.JSX.Element | null {
  const isOpen = useTerminalStore((s) => s.isOpen);
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const closeSession = useTerminalStore((s) => s.closeSession);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex h-72 flex-col border-t border-border bg-black/60 backdrop-blur-2xl">
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1">
        {sessions.length === 0 ? (
          <span className="px-2 py-1 text-xs text-white/50">
            No terminal sessions. Install a CLI or open one from a project.
          </span>
        ) : (
          sessions.map((session, index) => (
            <button
              key={session.id}
              title={session.title}
              onClick={() => setActiveSession(session.id)}
              className={cn(
                'group flex items-center gap-2 rounded-t-md px-3 py-1.5 text-xs',
                session.id === activeSessionId
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/80',
              )}
            >
              {index + 1}
              <X
                className="h-3 w-3 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(session.id);
                }}
              />
            </button>
          ))
        )}
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
