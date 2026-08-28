import type { TargetAI } from '../cli/registry.js';

export const PROMPT_TYPES = [
  'Frontend',
  'Backend',
  'Full Stack',
  'UI Design',
  'UX Review',
  'Product',
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

export type { TargetAI };

export interface GeneratePromptInput {
  rawInput: string;
  promptType: PromptType;
  targetAI: TargetAI;
}

/** A Build Prompt dialog pinned to the desktop as a floating widget window. */
export interface DesktopPromptBuildWidgetInstance {
  id: string;
  projectId: string;
  projectName: string;
  x: number;
  y: number;
}
