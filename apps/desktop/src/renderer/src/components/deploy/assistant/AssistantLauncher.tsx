import type { DeployServer } from '@shared/deployTypes';
import { Robot } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useDeployAssistantStore } from '@/stores/deployAssistantStore';
import { AssistantDrawer } from './AssistantDrawer';
import { useDeployAssistantEvents } from './hooks';

/**
 * The Deploy AI on every screen of a server (E09 T8): a button in the corner opens the drawer,
 * and a run that waits for the user says so on the button, in words.
 */

export function AssistantLauncher({ server }: { server: DeployServer }): React.JSX.Element {
  useDeployAssistantEvents();
  const openServerId = useDeployAssistantStore((state) => state.openServerId);
  const open = useDeployAssistantStore((state) => state.open);
  const phase = useDeployAssistantStore((state) => state.runs[server.id]?.progress?.phase);
  const waiting = phase === 'proposed' || phase === 'needs-input';

  return (
    <>
      {openServerId !== server.id && (
        <Button
          size="lg"
          className="fixed bottom-6 right-6 z-30 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.7)]"
          onClick={() => open(server.id)}
          aria-label={waiting ? 'Deploy AI, waiting for you' : 'Deploy AI'}
        >
          <Robot />
          Deploy AI
          {waiting && (
            <span className="rounded-full bg-warning px-1.5 text-[10px] font-medium text-warning-foreground">
              Waiting for you
            </span>
          )}
        </Button>
      )}
      <AssistantDrawer server={server} />
    </>
  );
}
