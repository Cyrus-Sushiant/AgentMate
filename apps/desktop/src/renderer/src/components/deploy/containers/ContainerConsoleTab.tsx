import type { ContainerSummary } from '@shared/deploy/protocol/generated/AgentMate.ServerCore.Contracts';
import { useState } from 'react';
import { Lock, TerminalSquare } from '@/components/icons';
import { EmptyState } from '@/components/pageKit';
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
      <EmptyState
        size="sm"
        icon={Lock}
        title="Consoles are for Admins"
        description="A shell in a container can read and change everything in it."
      />
    );
  }
  if (container.state !== 'running') {
    return (
      <EmptyState
        size="sm"
        icon={TerminalSquare}
        title="Not running"
        description={`${container.name} is not running. Start it to open a console.`}
      />
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
      <EmptyState
        size="sm"
        icon={TerminalSquare}
        title={`A shell in ${container.name}`}
        description={`Opens bash (or sh) in ${container.name} as its own user. Opening and closing it are recorded in the server's audit trail; what you type is not.`}
        action={
          <Button size="sm" onClick={open}>
            <TerminalSquare className="h-3.5 w-3.5" /> Open a console
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span role="status">{ended ? 'The shell has ended.' : `Console in ${container.name}`}</span>
        <div className="flex gap-2">
          {ended ? (
            <Button size="sm" variant="soft" onClick={open}>
              Open a new one
            </Button>
          ) : (
            <Button size="sm" variant="soft" onClick={() => setSession(null)}>
              Close the console
            </Button>
          )}
        </div>
      </div>
      <div
        className="relative min-h-72 flex-1 overflow-hidden rounded-xl bg-[var(--terminal-bg,#111)] ring-1 ring-inset ring-foreground/[0.08]"
        aria-label={`Console in ${container.name}`}
        role="group"
      >
        <TerminalPane key={session.id} meta={session} active onExit={() => setEnded(true)} />
      </div>
    </div>
  );
}
