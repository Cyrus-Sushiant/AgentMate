import { describe, expect, it } from 'vitest';
import type { AgentType } from '../types/index.js';
import {
  AGENT_TYPE_CLI_ID,
  AGENT_TYPE_DEFS,
  AGENT_TYPE_LABELS,
  AGENT_TYPES,
  agentTypeLabel,
  targetAIForProject,
} from './agentTypes.js';
import { CLI_REGISTRY, getCliDefinition } from './registry.js';

/**
 * A project's agent type is stored on disk and drives the Target AI, the bootstrap
 * templates and the badges. If one of these mappings points at a CLI id the registry
 * no longer has, the label quietly degrades to the raw enum value in the UI.
 */

const ALL_AGENT_TYPES: AgentType[] = [
  'claude-code',
  'gemini',
  'opencode',
  'codex',
  'cursor',
  'generic',
];

describe('AGENT_TYPE_DEFS', () => {
  it('covers every agent type exactly once', () => {
    const values = AGENT_TYPE_DEFS.map((def) => def.value);
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual([...ALL_AGENT_TYPES].sort());
  });

  it('points every non-generic type at a CLI that exists in the registry', () => {
    for (const def of AGENT_TYPE_DEFS) {
      if (def.cliId === null) {
        expect(def.value).toBe('generic');
        continue;
      }
      expect(getCliDefinition(def.cliId), def.value).toBeDefined();
    }
  });

  it('never maps two agent types onto the same CLI', () => {
    const cliIds = AGENT_TYPE_DEFS.map((def) => def.cliId).filter(
      (id): id is NonNullable<typeof id> => id !== null && id !== undefined,
    );
    expect(new Set(cliIds).size).toBe(cliIds.length);
  });
});

describe('AGENT_TYPE_CLI_ID', () => {
  it('mirrors the defs table', () => {
    for (const def of AGENT_TYPE_DEFS) {
      expect(AGENT_TYPE_CLI_ID[def.value], def.value).toBe(def.cliId);
    }
  });
});

describe('agentTypeLabel', () => {
  it('reads the label off the CLI so the pickers cannot drift', () => {
    for (const def of AGENT_TYPE_DEFS) {
      if (!def.cliId) continue;
      expect(agentTypeLabel(def.value), def.value).toBe(getCliDefinition(def.cliId)?.label);
    }
  });

  it('labels the project-only generic type itself', () => {
    expect(agentTypeLabel('generic')).toBe('Generic');
  });

  it('never returns an empty label', () => {
    for (const type of ALL_AGENT_TYPES) {
      expect(agentTypeLabel(type).trim(), type).not.toBe('');
    }
  });
});

describe('AGENT_TYPE_LABELS and AGENT_TYPES', () => {
  it('agree with agentTypeLabel for every type', () => {
    for (const type of ALL_AGENT_TYPES) {
      expect(AGENT_TYPE_LABELS[type], type).toBe(agentTypeLabel(type));
    }
  });

  it('lists the same entries as the defs table, in the same order', () => {
    expect(AGENT_TYPES.map((entry) => entry.value)).toEqual(
      AGENT_TYPE_DEFS.map((def) => def.value),
    );
    for (const entry of AGENT_TYPES) {
      expect(entry.label, entry.value).toBe(agentTypeLabel(entry.value));
      expect(entry.cliId, entry.value).toBe(AGENT_TYPE_CLI_ID[entry.value]);
    }
  });
});

describe('targetAIForProject', () => {
  it("prefers the agent type's own CLI, ignoring an unrelated override", () => {
    expect(targetAIForProject('gemini', 'codex-cli')).toBe(getCliDefinition('gemini-cli')?.label);
  });

  it('uses the explicit CLI override when the agent type has none', () => {
    expect(targetAIForProject('generic', 'codex-cli')).toBe(getCliDefinition('codex-cli')?.label);
  });

  it('falls back to the first registry entry for a generic project with no override', () => {
    expect(targetAIForProject('generic')).toBe(CLI_REGISTRY[0].label);
    expect(targetAIForProject('generic', null)).toBe(CLI_REGISTRY[0].label);
  });

  it('falls back rather than returning an unknown CLI id verbatim', () => {
    expect(targetAIForProject('generic', 'no-such-cli')).toBe(CLI_REGISTRY[0].label);
  });

  it('always returns a label the Target AI picker actually offers', () => {
    const labels = new Set(CLI_REGISTRY.map((cli) => cli.label));
    for (const type of ALL_AGENT_TYPES) {
      expect(labels.has(targetAIForProject(type)), type).toBe(true);
    }
  });
});
