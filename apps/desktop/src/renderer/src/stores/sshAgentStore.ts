import type { SshAgentMode, SshAgentPhase, SshAgentProgress } from '@shared/apiTypes';
import { create } from 'zustand';

export interface SshAgentSessionState {
  mode: SshAgentMode;
  phase: SshAgentPhase;
  step: number;
  command?: string;
  message?: string;
}

interface SshAgentStoreState {
  sessions: Record<string, SshAgentSessionState>;
  /** The mode the user picked last time, seeded into the dialog's next open. */
  lastMode: SshAgentMode;
  clear: (sessionId: string) => void;
}

export const useSshAgentStore = create<SshAgentStoreState>((set) => ({
  sessions: {},
  lastMode: 'approve-all',
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
  return state.phase !== 'finished' && state.phase !== 'error' && state.phase !== 'stopped';
}

export async function startSshAgentTask(
  sessionId: string,
  prompt: string,
  mode: SshAgentMode,
): Promise<void> {
  useSshAgentStore.setState((state) => ({
    lastMode: mode,
    sessions: { ...state.sessions, [sessionId]: { mode, phase: 'thinking', step: 0 } },
  }));
  try {
    await window.agentmat.sshAgent.start({ sessionId, prompt, mode });
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

export function stopSshAgentTask(sessionId: string): void {
  void window.agentmat.sshAgent.stop(sessionId);
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
      };
      return { sessions: { ...state.sessions, [progress.sessionId]: next } };
    });
  });
}
