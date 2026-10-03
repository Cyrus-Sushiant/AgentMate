import { coreErrorMessage } from '@shared/coreErrors';
import type { DeployServer } from '@shared/deployTypes';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Robot, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeployAssistantStore } from '@/stores/deployAssistantStore';
import { AssistantComposer } from './AssistantComposer';
import { AssistantTimeline } from './AssistantTimeline';
import { useAssistantMode } from './hooks';
import { ModeSwitch } from './ModeSwitch';

/**
 * The Deploy AI drawer (E09 T8), on the right of every Deploy screen. It shows what the AI was
 * pointed at, how commands run (the core's mode), the run as a timeline with approve and skip,
 * the live output, a stop button and follow-up questions. It does not cover the page, so the
 * logs stay readable next to it; Escape closes it and the run carries on.
 */

const ACTIVE = new Set(['thinking', 'proposed', 'running', 'needs-input', 'needs-password']);

export function AssistantDrawer({ server }: { server: DeployServer }): React.JSX.Element | null {
  const openServerId = useDeployAssistantStore((state) => state.openServerId);
  const draft = useDeployAssistantStore((state) => state.draft);
  const run = useDeployAssistantStore((state) => state.runs[server.id]);
  const close = useDeployAssistantStore((state) => state.close);
  const reset = useDeployAssistantStore((state) => state.reset);
  const clearDraft = useDeployAssistantStore((state) => state.clearDraft);
  const open = openServerId === server.id;
  const mode = useAssistantMode(server.id, open);
  const panel = useRef<HTMLElement | null>(null);
  const context = draft?.serverId === server.id ? draft.context : null;
  const progress = run?.progress ?? null;
  const running =
    (progress !== null && ACTIVE.has(progress.phase)) ||
    (progress?.phase === 'error' && progress.canContinue === true);
  const finished = progress?.phase === 'finished' || progress?.phase === 'stopped';

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  // A window opened (or reloaded) while a run goes on picks up where it is.
  useEffect(() => {
    if (!open || run) return;
    let cancelled = false;
    window.agentmat.deployAssistant.state(server.id).then(
      (state) => {
        if (!cancelled && state?.progress) {
          useDeployAssistantStore
            .getState()
            .progress({ serverId: server.id, progress: state.progress });
        }
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [open, run, server.id]);

  if (!open) return null;

  const serverId = server.id;
  const act = (work: Promise<unknown>) =>
    void work.catch((error: unknown) => toast.error(coreErrorMessage(error)));

  async function start(prompt: string, cliId: string | null): Promise<boolean> {
    try {
      reset(serverId);
      await window.agentmat.deployAssistant.start({
        serverId,
        prompt,
        cliId,
        ...(context ? { context } : {}),
      });
      return true;
    } catch (error) {
      toast.error(coreErrorMessage(error));
      return false;
    }
  }

  return (
    <aside
      ref={panel}
      tabIndex={-1}
      aria-label="Deploy AI"
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
      className="fixed bottom-0 right-0 top-0 z-40 flex w-[min(28rem,100vw)] flex-col border-l border-border bg-card shadow-xl focus:outline-none"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Robot className="h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Deploy AI</h2>
          <p className="truncate text-xs text-muted-foreground">on {server.nickname}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          aria-label="Close"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {mode.loading ? (
          <Skeleton className="h-8 w-full" />
        ) : mode.forbidden ? (
          <p role="alert" className="text-sm text-muted-foreground">
            The Deploy AI runs commands on the server, which only an Admin of this core may do.
          </p>
        ) : mode.info ? (
          <ModeSwitch server={server} mode={mode.info.mode} disabled={running} />
        ) : (
          <p role="alert" className="text-sm text-destructive">
            {coreErrorMessage(mode.error)}
          </p>
        )}

        {context && (
          <div aria-label="Context" className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-foreground">
              {context.title}
            </span>
            {context.containerId && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                container {context.containerId}
              </span>
            )}
            {!running && (
              <button
                type="button"
                onClick={clearDraft}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear
              </button>
            )}
          </div>
        )}

        <AssistantTimeline
          steps={run?.steps ?? []}
          progress={progress}
          onApprove={() => act(window.agentmat.deployAssistant.approve(serverId))}
          onSkip={() => act(window.agentmat.deployAssistant.skip(serverId))}
          onAnswer={(answer) => act(window.agentmat.deployAssistant.answer(serverId, answer))}
          onResume={() => act(window.agentmat.deployAssistant.resume(serverId))}
          onStop={() => act(window.agentmat.deployAssistant.stop(serverId))}
        />
      </div>

      <footer className="border-t border-border px-4 py-3">
        <AssistantComposer
          key={draft?.serverId === serverId ? draft.prompt : 'free'}
          running={running}
          finished={finished}
          initialPrompt={draft?.serverId === serverId ? draft.prompt : ''}
          disabled={!mode.info}
          onStart={start}
          onStop={() => act(window.agentmat.deployAssistant.stop(serverId))}
        />
      </footer>
    </aside>
  );
}
