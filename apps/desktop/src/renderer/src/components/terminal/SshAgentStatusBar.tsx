import type { SshAgentPhase } from '@shared/apiTypes';
import { MAX_SSH_AGENT_MESSAGE_CHARS } from '@shared/sshAgentMessage';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CircleCheck,
  History,
  Key,
  MessageSquare,
  Play,
  Robot,
  Send,
  StopCircle,
  TriangleAlert,
  X,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  answerSshAgentInput,
  answerSshAgentPassword,
  approveSshAgentCommand,
  continueSshAgentTask,
  sendSshAgentMessage,
  skipSshAgentCommand,
  stopSshAgentTask,
  useSshAgentSession,
  useSshAgentStore,
} from '@/stores/sshAgentStore';

/** The tallest the message box grows before it scrolls, about five lines. */
const COMPOSER_MAX_HEIGHT_PX = 112;
/** How long "Sent" stays under the box. The run moves on, and the queued pill keeps the live state. */
const SENT_NOTE_MS = 6000;

/** What the message box asks for, which depends on when the AI will get to read it. */
function composerPlaceholder(phase: SshAgentPhase, paused: boolean): string {
  if (paused) return 'Message the AI. It reads this when you continue…';
  switch (phase) {
    case 'proposed':
      return 'Tell the AI what to do instead. This skips the command above…';
    case 'running':
    case 'needs-password':
      return 'Message the AI. It reads this when the command finishes…';
    default:
      return 'Message the AI. It reads this right away…';
  }
}

/** The confirmation under the box, saying what happens to the message that was just sent. */
function sentNote(phase: SshAgentPhase, paused: boolean): string {
  if (paused) return 'Sent. The AI reads it when you continue.';
  switch (phase) {
    case 'proposed':
      return 'Sent. That command was skipped and the AI is reading your message.';
    case 'running':
    case 'needs-password':
      return 'Sent. The AI reads it when the command finishes.';
    default:
      return 'Sent. The AI is reading it now.';
  }
}

/**
 * The box under the bar for talking to a task that is already running: a correction, a
 * restriction, a new request. Enter sends, Shift+Enter starts a new line, Escape closes it.
 */
function MessageComposer({
  sessionId,
  phase,
  paused,
  draft,
  onDraftChange,
  onClose,
}: {
  sessionId: string;
  phase: SshAgentPhase;
  paused: boolean;
  /** Kept by the bar, so closing the box or an AI question in between does not lose the text. */
  draft: string;
  onDraftChange: (draft: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);
  // An object, so two sends in a row each get the full time on screen.
  const [note, setNote] = useState<{ text: string } | null>(null);

  // Grow with the text, like a chat box, up to a few lines.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field || !draft.length) return;
    field.style.height = 'auto';
    if (field.scrollHeight > 0) {
      // scrollHeight leaves out the border, but the height is set on the border box, so
      // without it the box comes up a few pixels short and shows a scrollbar.
      const needed = field.scrollHeight + (field.offsetHeight - field.clientHeight);
      field.style.height = `${Math.min(needed, COMPOSER_MAX_HEIGHT_PX)}px`;
      field.style.overflowY = needed > COMPOSER_MAX_HEIGHT_PX ? 'auto' : 'hidden';
    }
  }, [draft]);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), SENT_NOTE_MS);
    return () => clearTimeout(timer);
  }, [note]);

  async function submit(): Promise<void> {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      if (await sendSshAgentMessage(sessionId, text)) {
        onDraftChange('');
        setNote({ text: sentNote(phase, paused) });
        if (fieldRef.current) {
          fieldRef.current.style.height = '';
          fieldRef.current.style.overflowY = '';
        }
      } else {
        // The text stays in the box, so nothing typed is lost.
        toast.error('The AI task has already ended, so nothing was sent.');
      }
    } catch {
      toast.error("Couldn't send the message. Try again.");
    } finally {
      setSending(false);
      fieldRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border/40 px-3 py-2">
      <div className="flex items-end gap-2">
        <Textarea
          ref={fieldRef}
          autoFocus
          rows={1}
          value={draft}
          readOnly={sending}
          maxLength={MAX_SSH_AGENT_MESSAGE_CHARS}
          aria-label="Message to the AI"
          placeholder={composerPlaceholder(phase, paused)}
          onChange={(e) => {
            onDraftChange(e.target.value);
            setNote(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              onClose();
              return;
            }
            // Enter while an input method is composing picks a candidate rather than sending.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          className="min-h-8 flex-1 resize-none overflow-y-hidden py-1.5 text-xs leading-5"
          style={{ maxHeight: COMPOSER_MAX_HEIGHT_PX }}
        />
        <Button
          size="sm"
          aria-label="Send message"
          onClick={() => void submit()}
          disabled={!draft.trim() || sending}
          className="shrink-0 gap-1.5"
        >
          <Send className="h-3 w-3" />
          Send
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Close message box"
          onClick={onClose}
          className="mb-1 shrink-0"
        >
          <X />
        </Button>
      </div>
      <p
        role="status"
        className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground empty:hidden"
      >
        {note && (
          <>
            <CircleCheck className="h-3 w-3 shrink-0 text-primary" />
            {note.text}
          </>
        )}
      </p>
    </div>
  );
}

/** A slim bar above the terminal showing what the AI is doing, and any action it needs from you. */
export function SshAgentStatusBar({
  sessionId,
  onOpenHistory,
}: {
  sessionId: string;
  onOpenHistory: () => void;
}): React.JSX.Element | null {
  const state = useSshAgentSession(sessionId);
  const clear = useSshAgentStore((s) => s.clear);
  const [answer, setAnswer] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const messageButtonRef = useRef<HTMLButtonElement>(null);

  // A paused run looks like an error but is still alive, waiting for Continue or Stop.
  const paused = state?.phase === 'error' && state.canContinue === true;
  const done =
    !!state &&
    !paused &&
    (state.phase === 'finished' || state.phase === 'error' || state.phase === 'stopped');

  // Once the task is over there is nobody to message, and a leftover draft would greet the next one.
  useEffect(() => {
    if (state && !done) return;
    setComposerOpen(false);
    setDraft('');
  }, [state, done]);

  if (!state) return null;

  const waitingOnUser =
    paused ||
    state.phase === 'proposed' ||
    state.phase === 'needs-input' ||
    state.phase === 'needs-password';
  // A question has its own answer field, and what the user types there already reaches the AI.
  const canMessage = !done && state.phase !== 'needs-input';
  const queued = state.queuedMessages ?? 0;

  function submitAnswer(): void {
    answerSshAgentInput(sessionId, answer.trim());
    setAnswer('');
  }

  function closeComposer(): void {
    setComposerOpen(false);
    messageButtonRef.current?.focus();
  }

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col text-xs shadow-[inset_0_-1px_0_hsl(var(--border)/0.6)]',
        state.phase === 'error' && !paused && 'bg-destructive/10',
        (paused || state.phase === 'needs-input' || state.phase === 'needs-password') &&
          'bg-warning/10',
        !done &&
          state.phase !== 'needs-input' &&
          state.phase !== 'needs-password' &&
          state.phase !== 'error' &&
          'bg-primary/5',
      )}
    >
      <div className="flex min-h-9 items-center gap-2 px-3 py-1.5">
        {state.phase === 'error' ? (
          <TriangleAlert
            className={cn('h-3.5 w-3.5 shrink-0', paused ? 'text-warning' : 'text-destructive')}
          />
        ) : state.phase === 'needs-password' ? (
          <Key className="h-3.5 w-3.5 shrink-0 text-warning" />
        ) : state.phase === 'finished' ? (
          <CircleCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <Robot className={cn('h-3.5 w-3.5 shrink-0 text-primary', !done && 'animate-pulse')} />
        )}

        <span className="min-w-0 flex-1 truncate text-foreground/85">
          {state.phase === 'thinking' && `Step ${state.step}: thinking…`}
          {state.phase === 'proposed' && (
            <>
              Run{' '}
              <code className="rounded bg-foreground/[0.08] px-1 py-0.5 font-mono text-[11px]">
                {state.command}
              </code>
              ? {state.message}
            </>
          )}
          {state.phase === 'running' && (
            <>
              Running{' '}
              <code className="rounded bg-foreground/[0.08] px-1 py-0.5 font-mono text-[11px]">
                {state.command}
              </code>
            </>
          )}
          {(state.phase === 'needs-input' || state.phase === 'needs-password') && state.message}
          {state.phase === 'finished' && (state.message || 'Task complete.')}
          {state.phase === 'error' && state.message}
          {state.phase === 'stopped' && state.message}
        </span>

        {queued > 0 && (
          <span
            role="status"
            className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary"
          >
            {queued === 1 ? 'Message queued' : `${queued} messages queued`}
          </span>
        )}

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

        {paused && (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" onClick={() => continueSshAgentTask(sessionId)}>
              <Play className="h-3 w-3" />
              Continue
            </Button>
            <Button size="sm" variant="ghost" onClick={() => stopSshAgentTask(sessionId)}>
              <StopCircle className="h-3 w-3" />
              Stop
            </Button>
          </div>
        )}

        {canMessage && (
          <Button
            ref={messageButtonRef}
            size="sm"
            variant={composerOpen ? 'secondary' : 'ghost'}
            aria-expanded={composerOpen}
            onClick={() => (composerOpen ? closeComposer() : setComposerOpen(true))}
            className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="h-3 w-3" />
            Message
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenHistory}
          className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <History className="h-3 w-3" />
          History
        </Button>

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
            size="icon-xs"
            variant="ghost"
            onClick={() => clear(sessionId)}
            aria-label="Dismiss"
            className="shrink-0"
          >
            <X />
          </Button>
        )}
      </div>

      {canMessage && composerOpen && (
        <MessageComposer
          sessionId={sessionId}
          phase={state.phase}
          paused={paused}
          draft={draft}
          onDraftChange={setDraft}
          onClose={closeComposer}
        />
      )}
    </div>
  );
}
