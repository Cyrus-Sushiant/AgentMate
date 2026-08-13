import type { AgentType } from '../types/index.js';
import { CLI_REGISTRY, getCliDefinition, targetAIForCliId } from './registry.js';

/**
 * Project agent types and the CLI_REGISTRY id each one maps to.
 * Labels are read from that CLI so Target AI, the project form, and badges stay in sync.
 * `generic` is project-only (no CLI).
 */
export const AGENT_TYPE_DEFS = [
  { value: 'claude-code', cliId: 'claude-code' },
  { value: 'gemini', cliId: 'gemini-cli' },
  { value: 'opencode', cliId: 'opencode' },
  { value: 'codex', cliId: 'codex-cli' },
  { value: 'cursor', cliId: 'cursor-cli' },
  { value: 'generic', cliId: null },
] as const satisfies readonly { value: AgentType; cliId: string | null }[];

export const AGENT_TYPE_CLI_ID: Record<AgentType, string | null> = Object.fromEntries(
  AGENT_TYPE_DEFS.map((def) => [def.value, def.cliId]),
) as Record<AgentType, string | null>;

export function agentTypeLabel(agentType: AgentType): string {
  if (agentType === 'generic') return 'Generic';
  const cliId = AGENT_TYPE_CLI_ID[agentType];
  const cli = cliId ? getCliDefinition(cliId) : undefined;
  return cli?.label ?? agentType;
}

export const AGENT_TYPE_LABELS: Record<AgentType, string> = Object.fromEntries(
  AGENT_TYPE_DEFS.map((def) => [def.value, agentTypeLabel(def.value)]),
) as Record<AgentType, string>;

export const AGENT_TYPES: { value: AgentType; label: string; cliId: string | null }[] =
  AGENT_TYPE_DEFS.map((def) => ({
    value: def.value,
    label: agentTypeLabel(def.value),
    cliId: def.cliId,
  }));

/** Target AI label for a project: its agent type's CLI, then an explicit CLI override. */
export function targetAIForProject(agentType: AgentType, cliId?: string | null): string {
  const fromAgent = AGENT_TYPE_CLI_ID[agentType];
  if (fromAgent) {
    const label = targetAIForCliId(fromAgent);
    if (label) return label;
  }
  if (cliId) {
    const label = targetAIForCliId(cliId);
    if (label) return label;
  }
  return CLI_REGISTRY[0]?.label ?? 'Claude Code';
}
