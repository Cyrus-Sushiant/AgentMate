export const PROMPT_TYPES = [
  'Frontend',
  'Backend',
  'Full Stack',
  'UI Design',
  'UX Review',
  'API',
  'Database',
  'Testing',
  'Security',
  'Performance',
  'DevOps',
  'Documentation',
  'Refactoring',
  'Bug Fix',
  'Code Review',
  'Architecture',
  'Mobile',
  'Electron',
  'React',
  'Next.js',
  'Node.js',
  '.NET',
  'Flutter',
  'Python',
  'AI Agent',
  'Custom',
] as const;

export type PromptType = (typeof PROMPT_TYPES)[number];

export const TARGET_AIS = [
  'Claude',
  'Gemini',
  'OpenCode',
  'Codex',
  'Qwen',
  'Aider',
  'Goose',
  'Continue',
] as const;

export type TargetAI = (typeof TARGET_AIS)[number];

export interface GeneratePromptInput {
  rawInput: string;
  promptType: PromptType;
  targetAI: TargetAI;
}
