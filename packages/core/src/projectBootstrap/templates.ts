import type { AgentType } from '../types/index.js';

export const BOOTSTRAP_FOLDERS = [
  'skills',
  'memory',
  'agents',
  'prompts',
  'docs',
  '.agentmate',
  'templates',
  'config',
] as const;

export interface BootstrapFile {
  relativePath: string;
  content: string;
}

export interface ProjectMeta {
  name: string;
  description: string;
  agentType: AgentType;
}

const AGENT_LABELS: Record<AgentType, string> = {
  'claude-code': 'Claude Code',
  gemini: 'Gemini CLI',
  opencode: 'OpenCode',
  codex: 'Codex CLI',
  generic: 'a generic AI coding agent',
};

export function getBootstrapFiles(meta: ProjectMeta): BootstrapFile[] {
  const agentLabel = AGENT_LABELS[meta.agentType];
  const today = new Date().toISOString().slice(0, 10);

  return [
    {
      relativePath: 'README.md',
      content: `# ${meta.name}\n\n${meta.description || 'No description provided yet.'}\n\nThis project is configured for **${agentLabel}** via AgentMate.\n`,
    },
    {
      relativePath: 'PROJECT_CONTEXT.md',
      content: `# Project Context\n\n## Overview\n${meta.description || '(fill in project overview)'}\n\n## Agent\n${agentLabel}\n\n## Key Constraints\n- (add constraints here)\n\n## Stakeholders\n- (add stakeholders here)\n`,
    },
    {
      relativePath: 'MEMORY.md',
      content: `# Memory\n\nPersistent notes the agent should remember across sessions for this project.\n\n_Last updated: ${today}_\n`,
    },
    {
      relativePath: 'CODING_GUIDELINES.md',
      content: `# Coding Guidelines\n\n- Follow existing code style and conventions.\n- Prefer small, reviewable changes.\n- Add tests for new behavior.\n`,
    },
    {
      relativePath: 'ARCHITECTURE.md',
      content: `# Architecture\n\nDescribe the high-level architecture of ${meta.name} here.\n`,
    },
    {
      relativePath: 'ROADMAP.md',
      content: `# Roadmap\n\n## Now\n- \n\n## Next\n- \n\n## Later\n- \n`,
    },
    {
      relativePath: 'TASKS.md',
      content: `# Tasks\n\n- [ ] (add tasks here)\n`,
    },
    {
      relativePath: 'SKILLS.md',
      content: `# Skills\n\nSkills installed for this project via the AgentMate Skill Marketplace are listed here.\n`,
    },
  ];
}
