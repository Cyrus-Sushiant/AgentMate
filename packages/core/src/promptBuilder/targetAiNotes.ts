import type { TargetAI } from './types.js';

export const TARGET_AI_NOTES: Record<TargetAI, string> = {
  Claude: 'Use clear markdown structure with explicit headers; state constraints up front; ask for a brief plan before large edits.',
  Gemini: 'Be direct and concise; enumerate steps explicitly; prefer bullet lists over long prose.',
  OpenCode: 'State the target files/directories explicitly if known; keep instructions terminal-and-diff friendly.',
  Codex: 'Favor precise, code-first instructions; specify exact function/file names where possible.',
  Qwen: 'Keep instructions explicit and unambiguous; avoid idioms that may not translate well.',
  Aider: 'Reference exact file paths to edit; keep the request scoped to a small, reviewable diff.',
  Goose: 'Describe the desired end state and let it choose tool calls; provide acceptance criteria.',
  Continue: 'Keep the request self-contained since context window/session state may reset between runs.',
};
