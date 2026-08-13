import { cliIdForTargetAI } from '../cli/registry.js';

const DEFAULT_TARGET_AI_NOTE =
  'Be explicit about the desired outcome, constraints, and files to touch.';

/** Notes keyed by CLI_REGISTRY id. Missing CLIs fall back to DEFAULT_TARGET_AI_NOTE. */
const TARGET_AI_NOTES_BY_CLI_ID: Record<string, string> = {
  'claude-code':
    'Use clear markdown structure with explicit headers; state constraints up front; ask for a brief plan before large edits.',
  'gemini-cli':
    'Be direct and concise; enumerate steps explicitly; prefer bullet lists over long prose.',
  opencode:
    'State the target files/directories explicitly if known; keep instructions terminal-and-diff friendly.',
  'codex-cli':
    'Favor precise, code-first instructions; specify exact function/file names where possible.',
  'qwen-cli':
    'Keep instructions explicit and unambiguous; avoid idioms that may not translate well.',
  aider: 'Reference exact file paths to edit; keep the request scoped to a small, reviewable diff.',
  goose: 'Describe the desired end state and let it choose tool calls; provide acceptance criteria.',
  'continue-cli':
    'Keep the request self-contained since context window/session state may reset between runs.',
  'cursor-cli':
    'State the goal and constraints clearly; name the files to edit when known; keep the request scoped so the agent can apply a reviewable diff.',
  'grok-cli':
    'Be direct; spell out the files, the expected change, and what should stay untouched.',
  'cline-cli':
    'Give a concrete end state and acceptance criteria; mention paths to edit when you know them.',
  'freebuff-cli':
    'Keep the request self-contained and explicit about files, constraints, and the desired result.',
};

export function targetAINote(targetAI: string): string {
  const cliId = cliIdForTargetAI(targetAI);
  if (cliId && TARGET_AI_NOTES_BY_CLI_ID[cliId]) return TARGET_AI_NOTES_BY_CLI_ID[cliId];
  return DEFAULT_TARGET_AI_NOTE;
}
