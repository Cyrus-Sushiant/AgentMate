import { describe, expect, it } from 'vitest';
import type { AgentType } from '../types/index.js';
import {
  AGENT_TYPE_SKILLS_DIR,
  allProjectSkillRemoveDirs,
  KNOWN_AGENT_DIRS,
  resolveProjectSkillInstallDirs,
  skillsDirForAgentRoot,
} from './installPaths.js';

/**
 * These are the folders a skill is copied into and later deleted from, so they have
 * to stay project-relative: an absolute path would put the sandboxed fs IPC in the
 * position of writing outside the project. The remove list also has to stay wider
 * than the install list, or a skill installed by an older build becomes unremovable.
 */

const ALL_AGENT_TYPES: AgentType[] = [
  'claude-code',
  'gemini',
  'opencode',
  'codex',
  'cursor',
  'generic',
];

describe('AGENT_TYPE_SKILLS_DIR', () => {
  it('covers every agent type', () => {
    expect(Object.keys(AGENT_TYPE_SKILLS_DIR).sort()).toEqual([...ALL_AGENT_TYPES].sort());
  });

  it('is relative, posix-separated, and always lands under a known agent root', () => {
    for (const type of ALL_AGENT_TYPES) {
      const dir = AGENT_TYPE_SKILLS_DIR[type];
      expect(dir, type).toMatch(/^\.[a-z]+\/skills$/);
      expect(dir, type).not.toContain('\\');
      expect(dir, type).not.toContain('..');
      expect(KNOWN_AGENT_DIRS as readonly string[], type).toContain(dir.split('/')[0]);
    }
  });
});

describe('KNOWN_AGENT_DIRS', () => {
  it('lists unique dotted folder names', () => {
    expect(new Set(KNOWN_AGENT_DIRS).size).toBe(KNOWN_AGENT_DIRS.length);
    for (const dir of KNOWN_AGENT_DIRS) {
      expect(dir, dir).toMatch(/^\.[a-z]+$/);
    }
  });
});

describe('skillsDirForAgentRoot', () => {
  it('appends the skills folder', () => {
    expect(skillsDirForAgentRoot('.claude')).toBe('.claude/skills');
    expect(skillsDirForAgentRoot('.agents')).toBe('.agents/skills');
  });
});

describe('resolveProjectSkillInstallDirs', () => {
  it("uses the project agent's own folder when it already exists on disk", () => {
    expect(resolveProjectSkillInstallDirs('claude-code', ['.claude', '.cursor'])).toEqual([
      '.claude/skills',
    ]);
  });

  it('falls back to every other agent folder that is present', () => {
    // Nothing named `.claude` here, so the skill goes wherever the repo is already set up.
    expect(resolveProjectSkillInstallDirs('claude-code', ['.cursor', '.gemini'])).toEqual([
      '.cursor/skills',
      '.gemini/skills',
    ]);
  });

  it('keeps that fallback in KNOWN_AGENT_DIRS order rather than the caller order', () => {
    expect(resolveProjectSkillInstallDirs('claude-code', ['.gemini', '.cursor'])).toEqual([
      '.cursor/skills',
      '.gemini/skills',
    ]);
  });

  it("creates the agent's default folder on a fresh project with nothing set up", () => {
    expect(resolveProjectSkillInstallDirs('codex', [])).toEqual(['.codex/skills']);
    expect(resolveProjectSkillInstallDirs('generic', [])).toEqual(['.agents/skills']);
  });

  it('ignores folders that are not agent roots', () => {
    expect(resolveProjectSkillInstallDirs('gemini', ['node_modules', 'src'])).toEqual([
      '.agents/skills',
    ]);
  });

  it('shares .agents between the agents that have no folder of their own', () => {
    // gemini, opencode and generic all read the shared folder, so an existing .agents
    // is the preferred root for all three.
    for (const type of ['gemini', 'opencode', 'generic'] as AgentType[]) {
      expect(resolveProjectSkillInstallDirs(type, ['.agents']), type).toEqual(['.agents/skills']);
    }
  });

  it('never returns an empty list, or an absolute or climbing path', () => {
    for (const type of ALL_AGENT_TYPES) {
      for (const existing of [[], ['.claude'], ['.cursor', '.factory'], ['nope']]) {
        const dirs = resolveProjectSkillInstallDirs(type, existing);
        expect(dirs.length, type).toBeGreaterThan(0);
        for (const dir of dirs) {
          expect(dir, dir).not.toMatch(/^([a-zA-Z]:|[\\/])/);
          expect(dir, dir).not.toContain('..');
        }
      }
    }
  });
});

describe('allProjectSkillRemoveDirs', () => {
  it('covers every known agent folder plus the legacy root skills/ path', () => {
    const dirs = allProjectSkillRemoveDirs(null);
    for (const root of KNOWN_AGENT_DIRS) {
      expect(dirs, root).toContain(`${root}/skills`);
    }
    expect(dirs).toContain('skills');
  });

  it('has no duplicates even when the agent default is already in the list', () => {
    const dirs = allProjectSkillRemoveDirs('claude-code');
    expect(new Set(dirs).size).toBe(dirs.length);
    expect(dirs).toContain('.claude/skills');
  });

  it('is a superset of what an install could ever have written', () => {
    for (const type of ALL_AGENT_TYPES) {
      const removable = new Set(allProjectSkillRemoveDirs(type));
      for (const existing of [[], ['.claude'], [...KNOWN_AGENT_DIRS]]) {
        for (const dir of resolveProjectSkillInstallDirs(type, existing)) {
          expect(removable.has(dir), `${type}: ${dir}`).toBe(true);
        }
      }
    }
  });
});
