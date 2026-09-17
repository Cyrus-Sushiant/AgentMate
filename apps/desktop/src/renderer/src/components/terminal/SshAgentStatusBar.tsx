import { useState } from 'react';
import { CircleCheck, Key, Robot, StopCircle, TriangleAlert, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  answerSshAgentInput,
  answerSshAgentPassword,
  approveSshAgentCommand,
  skipSshAgentCommand,
  stopSshAgentTask,
  useSshAgentSession,
  useSshAgentStore,
} from '@/stores/sshAgentStore';

/** A slim bar above the terminal showing what the AI is doing, and any action it needs from you. */
export function SshAgentStatusBar({ sessionId }: { sessionId: string }): React.JSX.Element | null {
  const state = useSshAgentSession(sessionId);
  const clear = useSshAgentStore((s) => s.clear);
  const [answer, setAnswer] = useState('');

  if (!state) return null;

  const done = state.phase === 'finished' || state.phase === 'error' || state.phase === 'stopped';
  const waitingOnUser =
    state.phase === 'proposed' || state.phase === 'needs-input' || state.phase === 'needs-password';

  function submitAnswer(): void {
    answerSshAgentInput(sessionId, answer.trim());
    setAnswer('');
  }

  return (
    <div
      className={cn(
        'flex min-h-9 shrink-0 items-center gap-2 border-b border-white/5 px-3 py-1.5 text-xs',
        state.phase === 'error' && 'bg-destructive/10',
        (state.phase === 'needs-input' || state.phase === 'needs-password') && 'bg-amber-500/10',
        !done &&
          state.phase !== 'needs-input' &&
          state.phase !== 'needs-password' &&
          state.phase !== 'error' &&
          'bg-primary/5',
      )}
    >
      {state.phase === 'error' ? (
        <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
      ) : state.phase === 'needs-password' ? (
        <Key className="h-3.5 w-3.5 shrink-0 text-amber-400" />
      ) : state.phase === 'finished' ? (
        <CircleCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
      ) : (
        <Robot className={cn('h-3.5 w-3.5 shrink-0 text-primary', !done && 'animate-pulse')} />
      )}

      <span className="min-w-0 flex-1 truncate text-zinc-300">
        {state.phase === 'thinking' && `Step ${state.step}: thinking…`}
        {state.phase === 'proposed' && (
          <>
            Run <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">{state.command}</code>
            ? {state.message}
          </>
        )}
        {state.phase === 'running' && (
          <>
            Running{' '}
            <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">{state.command}</code>
          </>
        )}
        {(state.phase === 'needs-input' || state.phase === 'needs-password') && state.message}
        {state.phase === 'finished' && (state.message || 'Task complete.')}
        {state.phase === 'error' && state.message}
        {state.phase === 'stopped' && state.message}
      </span>

      {state.phase === 'proposed' && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" onClick={() => approveSshAgentCommand(sessionId)}>
            Run
          </Button>
          <Button size="sm" variant="ghost" onClick={() => skipSshAgentCommand(sessionId)}>
            Skip
          </Button>
        </div>
      )}

      {state.phase === 'needs-input' && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Input
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitAnswer();
            }}
            placeholder="Your answer…"
            className="h-7 w-48 text-xs"
          />
          <Button size="sm" onClick={submitAnswer} disabled={!answer.trim()}>
            Send
          </Button>
        </div>
      )}

      {state.phase === 'needs-password' && (
        <div className="flex shrink-0 items-center gap-1.5">
          {state.hasSavedPassword ? (
            <>
              <Button size="sm" onClick={() => answerSshAgentPassword(sessionId, true)}>
                Enter password
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => answerSshAgentPassword(sessionId, false)}
              >
                I&apos;ll type it
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => answerSshAgentPassword(sessionId, false)}
            >
              OK
            </Button>
          )}
        </div>
      )}

      {!done && !waitingOnUser && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => stopSshAgentTask(sessionId)}
          className="shrink-0"
        >
          <StopCircle className="h-3 w-3" />
          Stop
        </Button>
      )}

      {done && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => clear(sessionId)}
          aria-label="Dismiss"
          className="h-6 w-6 shrink-0 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
