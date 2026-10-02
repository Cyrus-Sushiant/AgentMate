import type { ContainerSummary } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { useState } from 'react';
import { Lock, TerminalSquare } from '@/components/icons';
import { TerminalPane } from '@/components/terminal/TerminalPane';
import { Button } from '@/components/ui/button';
import type { TerminalSessionMeta } from '@/stores/terminalStore';

/**
 * A shell inside a running container (E06 T6), for Admins: docker exec with a terminal, drawn
 * with the app's own terminal pane. Opening and closing it land in the server's audit trail;
 * what is typed does not. It opens on request, not when the tab is shown.
 */

export function ContainerConsoleTab({
  serverId,
  container,
  canOpen,
}: {
  serverId: string;
  container: ContainerSummary;
  canOpen: boolean;
}): React.JSX.Element {
  const [session, setSession] = useState<TerminalSessionMeta | null>(null);
  const [ended, setEnded] = useState(false);

  if (!canOpen) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" /> Consoles are for Admins: a shell in a container can
        read and change everything in it.
      </p>
    );
  }
  if (container.state !== 'running') {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {container.name} is not running. Start it to open a console.
      </p>
    );
  }

  const open = () => {
    setEnded(false);
    setSession({
      id: crypto.randomUUID(),
      title: container.name,
      kind: 'container',
      container: { serverId, containerId: container.id },
    });
  };

  if (!session) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-secondary/20 p-4">
        <p className="text-sm text-muted-foreground">
          Opens bash (or sh) in {container.name} as its own user. Opening and closing it are
          recorded in the server's audit trail; what you type is not.
        </p>
        <Button size="sm" className="gap-1.5" onClick={open}>
          <TerminalSquare className="h-3.5 w-3.5" /> Open a console
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span role="status">{ended ? 'The shell has ended.' : `Console in ${container.name}`}</span>
        <div className="flex gap-2">
          {ended ? (
            <Button size="sm" variant="outline" onClick={open}>
              Open a new one
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setSession(null)}>
              Close the console
            </Button>
          )}
        </div>
      </div>
      <div
        className="relative min-h-72 flex-1 overflow-hidden rounded-lg border border-border bg-[var(--terminal-bg,#111)]"
        aria-label={`Console in ${container.name}`}
        role="group"
      >
        <TerminalPane key={session.id} meta={session} active onExit={() => setEnded(true)} />
      </div>
    </div>
  );
}
