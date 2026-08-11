import type { AgentType } from '../types/index.js';

/**
 * Where a repo/local skill should land for each project agent type. Mirrors the folders
 * project bootstrap creates (and the shared `.agents/skills` convention for agents without
 * a dedicated skills dir of their own).
 */
export const AGENT_TYPE_SKILLS_DIR: Record<AgentType, string> = {
  'claude-code': '.claude/skills',
  codex: '.codex/skills',
  cursor: '.cursor/skills',
  gemini: '.agents/skills',
  opencode: '.agents/skills',
  generic: '.agents/skills',
};

/**
 * Agent config roots that commonly hold a `skills/` subdirectory. Used to detect which
 * assistants a project already has set up, so installs go into those folders rather than a
 * bare `skills/` directory at the project root.
 */
export const KNOWN_AGENT_DIRS = [
  '.claude',
  '.agents',
  '.codex',
  '.cursor',
  '.windsurf',
  '.continue',
  '.factory',
  '.gemini',
  '.opencode',
] as const;

/** Project-relative `skills` dir for an agent config root (e.g. `.claude` → `.claude/skills`). */
export function skillsDirForAgentRoot(agentRoot: string): string {
  return `${agentRoot}/skills`;
}

/**
 * Relative install dirs for a project-scoped skill copy.
 *
 * Prefers the project's `agentType` folder when that agent dir already exists. Otherwise uses
 * every known agent dir that is present on disk. If none are present, falls back to creating
 * the `agentType` default (so a fresh project still gets a sensible destination).
 */
export function resolveProjectSkillInstallDirs(
  agentType: AgentType,
  existingAgentDirs: readonly string[],
): string[] {
  const preferred = AGENT_TYPE_SKILLS_DIR[agentType] ?? AGENT_TYPE_SKILLS_DIR.generic;
  const preferredRoot = preferred.split('/')[0];
  const existing = new Set(existingAgentDirs);

  if (preferredRoot && existing.has(preferredRoot)) {
    return [preferred];
  }

  const fromDisk = KNOWN_AGENT_DIRS.filter((dir) => existing.has(dir)).map(skillsDirForAgentRoot);
  if (fromDisk.length > 0) return fromDisk;

  return [preferred];
}

/** Every relative dir a remove should check, including the legacy root `skills/` path. */
export function allProjectSkillRemoveDirs(agentType: AgentType | null): string[] {
  const dirs = new Set<string>([...KNOWN_AGENT_DIRS.map(skillsDirForAgentRoot), 'skills']);
  if (agentType) dirs.add(AGENT_TYPE_SKILLS_DIR[agentType] ?? AGENT_TYPE_SKILLS_DIR.generic);
  return [...dirs];
}
