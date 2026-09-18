import { describe, expect, it } from 'vitest';
import {
  CLI_REGISTRY,
  CliDefinitionSchema,
  cliIdForTargetAI,
  DEFAULT_TARGET_AI,
  getCliDefinition,
  getInstallCommandForCurrentOS,
  getUpdateCommandForCurrentOS,
  isTargetAI,
  normalizeTargetAI,
  resolvePromptTargetAI,
  type SupportedOS,
  TARGET_AIS,
  targetAIForCliId,
} from './registry.js';

/**
 * The registry is the single list behind CLI detection, every agent picker, the
 * per-CLI arguments field and the update checker. An entry that is missing a piece
 * one of those needs fails silently in the UI, so the invariants are asserted here.
 */

describe('CLI_REGISTRY invariants', () => {
  it('is not empty, since the first entry is the app-wide default', () => {
    expect(CLI_REGISTRY.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const ids = CLI_REGISTRY.map((cli) => cli.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique labels, because a picker addresses a CLI by its label', () => {
    const labels = CLI_REGISTRY.map((cli) => cli.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('uses kebab-case ids so they are safe as settings keys and file names', () => {
    for (const cli of CLI_REGISTRY) {
      expect(cli.id, cli.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('matches its own schema, including the URL fields', () => {
    for (const cli of CLI_REGISTRY) {
      expect(() => CliDefinitionSchema.parse(cli), cli.id).not.toThrow();
    }
  });

  it('gives every entry the text the UI shows', () => {
    for (const cli of CLI_REGISTRY) {
      expect(cli.name.trim(), cli.id).not.toBe('');
      expect(cli.label.trim(), cli.id).not.toBe('');
      expect(cli.description.trim(), cli.id).not.toBe('');
    }
  });

  it('gives every entry what detection needs', () => {
    for (const cli of CLI_REGISTRY) {
      expect(cli.executableNames.length, cli.id).toBeGreaterThan(0);
      expect(cli.detectCommand.command.trim(), cli.id).not.toBe('');
      expect(cli.versionCommand.command.trim(), cli.id).not.toBe('');
      // Detection runs the binary directly, so the probe has to name one of the
      // executables the PATH lookup searched for.
      expect(cli.executableNames, cli.id).toContain(cli.detectCommand.command);
      expect(cli.executableNames, cli.id).toContain(cli.versionCommand.command);
    }
  });

  it('gives every entry an install command for each OS it claims to support', () => {
    for (const cli of CLI_REGISTRY) {
      expect(cli.supportedOS.length, cli.id).toBeGreaterThan(0);
      expect(new Set(cli.supportedOS).size, cli.id).toBe(cli.supportedOS.length);
      for (const os of cli.supportedOS) {
        expect(cli.installCommand[os], `${cli.id} on ${os}`).toBeTruthy();
      }
    }
  });

  it('only lists install and update commands for an OS it supports', () => {
    for (const cli of CLI_REGISTRY) {
      const supported = new Set<string>(cli.supportedOS);
      for (const os of Object.keys(cli.installCommand)) {
        expect(supported.has(os), `${cli.id} installCommand ${os}`).toBe(true);
      }
      for (const os of Object.keys(cli.updateCommand ?? {})) {
        expect(supported.has(os), `${cli.id} updateCommand ${os}`).toBe(true);
      }
    }
  });

  it('only sets promptInputMode and promptWriteArgs on a CLI that has a prompt command', () => {
    for (const cli of CLI_REGISTRY) {
      if (cli.promptCommand) continue;
      expect(cli.promptInputMode, cli.id).toBeUndefined();
      expect(cli.promptWriteArgs, cli.id).toBeUndefined();
    }
  });

  it('never leaves a write-arg list empty, which would read as "no args needed"', () => {
    for (const cli of CLI_REGISTRY) {
      if (!cli.promptWriteArgs) continue;
      expect(cli.promptWriteArgs.length, cli.id).toBeGreaterThan(0);
    }
  });

  it('names a package for every update check', () => {
    for (const cli of CLI_REGISTRY) {
      if (!cli.updateCheck) continue;
      expect(cli.updateCheck.package.trim(), cli.id).not.toBe('');
      if (cli.updateCheck.type === 'github-release') {
        // github-release looks the package up as owner/repo.
        expect(cli.updateCheck.package, cli.id).toMatch(/^[^/\s]+\/[^/\s]+$/);
      }
    }
  });
});

describe('getCliDefinition', () => {
  it('finds an entry by id', () => {
    expect(getCliDefinition(CLI_REGISTRY[0].id)?.label).toBe(CLI_REGISTRY[0].label);
  });

  it('returns undefined for an unknown or empty id', () => {
    expect(getCliDefinition('no-such-cli')).toBeUndefined();
    expect(getCliDefinition('')).toBeUndefined();
  });
});

describe('TARGET_AIS', () => {
  it('is exactly the registry labels, in registry order', () => {
    expect([...TARGET_AIS]).toEqual(CLI_REGISTRY.map((cli) => cli.label));
  });

  it('defaults to the first registry entry', () => {
    expect(DEFAULT_TARGET_AI).toBe(CLI_REGISTRY[0].label);
  });
});

describe('normalizeTargetAI', () => {
  it('maps the legacy "Claude" label onto Claude Code', () => {
    expect(normalizeTargetAI('Claude')).toBe('Claude Code');
  });

  it('accepts a current label unchanged', () => {
    for (const label of TARGET_AIS) {
      expect(normalizeTargetAI(label)).toBe(label);
    }
  });

  it('accepts a CLI id and returns its label', () => {
    for (const cli of CLI_REGISTRY) {
      expect(normalizeTargetAI(cli.id), cli.id).toBe(cli.label);
    }
  });

  it('passes an unknown value back untouched, so nothing is silently rewritten', () => {
    expect(normalizeTargetAI('Some Future Agent')).toBe('Some Future Agent');
    expect(normalizeTargetAI('')).toBe('');
  });
});

describe('isTargetAI', () => {
  it('accepts every label, every id, and the legacy label', () => {
    for (const cli of CLI_REGISTRY) {
      expect(isTargetAI(cli.label), cli.label).toBe(true);
      expect(isTargetAI(cli.id), cli.id).toBe(true);
    }
    expect(isTargetAI('Claude')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isTargetAI('Some Future Agent')).toBe(false);
    expect(isTargetAI('')).toBe(false);
  });
});

describe('cliIdForTargetAI and targetAIForCliId', () => {
  it('round trip through each other for every registry entry', () => {
    for (const cli of CLI_REGISTRY) {
      expect(cliIdForTargetAI(cli.label), cli.label).toBe(cli.id);
      expect(targetAIForCliId(cli.id), cli.id).toBe(cli.label);
      expect(targetAIForCliId(cliIdForTargetAI(cli.label) ?? ''), cli.id).toBe(cli.label);
    }
  });

  it('resolves the legacy label too', () => {
    expect(cliIdForTargetAI('Claude')).toBe('claude-code');
  });

  it('returns undefined for an unknown name or id', () => {
    expect(cliIdForTargetAI('Some Future Agent')).toBeUndefined();
    expect(targetAIForCliId('no-such-cli')).toBeUndefined();
  });
});

describe('resolvePromptTargetAI', () => {
  const fallback = 'Gemini';

  it('uses the fallback when nothing is stored', () => {
    expect(resolvePromptTargetAI(undefined, fallback)).toBe(fallback);
    expect(resolvePromptTargetAI('', fallback)).toBe(fallback);
  });

  it('keeps a stored value that still names a known CLI', () => {
    expect(resolvePromptTargetAI('Claude Code', fallback)).toBe('Claude Code');
    expect(resolvePromptTargetAI('claude-code', fallback)).toBe('Claude Code');
  });

  it('falls back when the stored value names nothing in the registry', () => {
    expect(resolvePromptTargetAI('Some Future Agent', fallback)).toBe(fallback);
  });

  it('lets the project win over the old hardcoded "Claude" on an untouched form', () => {
    expect(resolvePromptTargetAI('Claude', fallback, { untouched: true })).toBe(fallback);
  });

  it('keeps "Claude" once the user has started typing', () => {
    expect(resolvePromptTargetAI('Claude', fallback, { untouched: false })).toBe('Claude Code');
    expect(resolvePromptTargetAI('Claude', fallback)).toBe('Claude Code');
  });

  it('leaves an untouched form alone when the project agent already is Claude Code', () => {
    expect(resolvePromptTargetAI('Claude', 'Claude Code', { untouched: true })).toBe('Claude Code');
  });
});

describe('install and update commands per OS', () => {
  const platforms: SupportedOS[] = ['win32', 'darwin', 'linux'];

  it('returns the install command for a supported OS and null otherwise', () => {
    for (const cli of CLI_REGISTRY) {
      for (const os of platforms) {
        const command = getInstallCommandForCurrentOS(cli, os);
        if (cli.supportedOS.includes(os)) expect(command, `${cli.id} ${os}`).toBeTruthy();
        else expect(command, `${cli.id} ${os}`).toBeNull();
      }
    }
  });

  it('falls back to the install command when no update command is listed', () => {
    for (const cli of CLI_REGISTRY) {
      for (const os of platforms) {
        const expected = cli.updateCommand?.[os] ?? cli.installCommand[os] ?? null;
        expect(getUpdateCommandForCurrentOS(cli, os), `${cli.id} ${os}`).toBe(expected);
      }
    }
  });
});
