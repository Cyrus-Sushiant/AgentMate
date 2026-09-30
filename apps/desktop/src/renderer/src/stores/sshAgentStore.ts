import type { EffortLevel } from '@agentmat/core';
import type {
  SshAgentMode,
  SshAgentPhase,
  SshAgentProgress,
  StartSshAgentTaskInput,
} from '@shared/apiTypes';
import { create } from 'zustand';
import { useTerminalStore } from './terminalStore';

export interface SshAgentSessionState {
  mode: SshAgentMode;
  phase: SshAgentPhase;
  step: number;
  command?: string;
  message?: string;
  hasSavedPassword?: boolean;
  /** Set on an `error` the run is paused on, rather than ended by. */
  canContinue?: boolean;
}

/** The AI the user picked last time: a CLI with its model and effort, or null for Settings' provider. */
export interface SshAgentAiChoice {
  cliId: string | null;
  modelId: string | null;
  effort: EffortLevel | null;
}

interface SshAgentStoreState {
  sessions: Record<string, SshAgentSessionState>;
  /** The mode the user picked last time, seeded into the dialog's next open. */
  lastMode: SshAgentMode;
  /** Same for the AI choice. Undefined until the dialog has been used once. */
  lastAi: SshAgentAiChoice | undefined;
  clear: (sessionId: string) => void;
}

export const useSshAgentStore = create<SshAgentStoreState>((set) => ({
  sessions: {},
  lastMode: 'approve-all',
  lastAi: undefined,
  clear: (sessionId) =>
    set((state) => {
      if (!(sessionId in state.sessions)) return state;
      const sessions = { ...state.sessions };
      delete sessions[sessionId];
      return { sessions };
    }),
}));

export function useSshAgentSession(sessionId: string | null): SshAgentSessionState | undefined {
  return useSshAgentStore((s) => (sessionId ? s.sessions[sessionId] : undefined));
}

/** True whenever the run can still act (waiting on the AI, or waiting on the user's OK/answer). */
export function isSshAgentActive(state: SshAgentSessionState | undefined): boolean {
  if (!state) return false;
  if (state.phase === 'error') return state.canContinue === true;
  return state.phase !== 'finished' && state.phase !== 'stopped';
}

/** True while the run can't go on until the user does something. */
export function isSshAgentWaitingOnUser(state: SshAgentSessionState | undefined): boolean {
  if (!state) return false;
  return (
    state.phase === 'proposed' ||
    state.phase === 'needs-input' ||
    state.phase === 'needs-password' ||
    (state.phase === 'error' && state.canContinue === true)
  );
}

export async function startSshAgentTask(input: StartSshAgentTaskInput): Promise<void> {
  const { sessionId, mode } = input;
  useSshAgentStore.setState((state) => ({
    lastMode: mode,
    lastAi: {
      cliId: input.cliId ?? null,
      modelId: input.modelId ?? null,
      effort: input.effort ?? null,
    },
    sessions: { ...state.sessions, [sessionId]: { mode, phase: 'thinking', step: 0 } },
  }));
  try {
    await window.agentmat.sshAgent.start(input);
  } catch (error) {
    useSshAgentStore.getState().clear(sessionId);
    throw error;
  }
}

export function approveSshAgentCommand(sessionId: string): void {
  void window.agentmat.sshAgent.approveCommand(sessionId);
}

export function skipSshAgentCommand(sessionId: string): void {
  void window.agentmat.sshAgent.skipCommand(sessionId);
}

export function answerSshAgentInput(sessionId: string, answer: string): void {
  void window.agentmat.sshAgent.answerNeedsInput(sessionId, answer);
}

export function answerSshAgentPassword(sessionId: string, approved: boolean): void {
  void window.agentmat.sshAgent.answerPassword(sessionId, approved);
}

export function stopSshAgentTask(sessionId: string): void {
  void window.agentmat.sshAgent.stop(sessionId);
}

export function continueSshAgentTask(sessionId: string): void {
  void window.agentmat.sshAgent.continueTask(sessionId);
}

/**
 * Whether the user can see this terminal right now: AgentMate is the focused app, the terminal
 * panel is open, and this is the tab it shows.
 */
function isWatchingSession(sessionId: string): boolean {
  const terminal = useTerminalStore.getState();
  return (
    document.hasFocus() &&
    document.visibilityState === 'visible' &&
    terminal.isOpen &&
    terminal.activeSessionId === sessionId
  );
}

let started = false;

/** Starts following AI-task progress for every SSH session, for the whole app's lifetime. */
export function initSshAgentStatus(): void {
  if (started) return;
  started = true;
  window.agentmat.sshAgent.onProgress((progress: SshAgentProgress) => {
    useSshAgentStore.setState((state) => {
      const existing = state.sessions[progress.sessionId];
      const next: SshAgentSessionState = {
        mode: existing?.mode ?? state.lastMode,
        phase: progress.phase,
        step: progress.step,
        command: progress.command ?? existing?.command,
        message: progress.message,
        hasSavedPassword: progress.hasSavedPassword,
        canContinue: progress.canContinue,
      };
      return { sessions: { ...state.sessions, [progress.sessionId]: next } };
    });

    const now = useSshAgentStore.getState().sessions[progress.sessionId];
    if (isSshAgentWaitingOnUser(now) && !isWatchingSession(progress.sessionId)) {
      const title =
        useTerminalStore.getState().sessions.find((s) => s.id === progress.sessionId)?.title ?? '';
      void window.agentmat.sshAgent.notifyWaiting(progress.sessionId, title);
    }
  });
}
