import { describe, expect, it } from 'vitest';
import { configuredArgsWithout } from '../promptBuilder/runRecommendation.js';
import { parseCliArgs } from './args.js';
import {
  cliLaunchOptions,
  launchDefaultArgs,
  launchDefaultParts,
  normalizeCliLaunchDefaults,
  savedArgSettings,
} from './launchDefaults.js';

describe('launchDefaultArgs', () => {
  it('adds nothing when nothing is set', () => {
    expect(launchDefaultArgs('claude-code', undefined)).toEqual([]);
    expect(launchDefaultArgs('claude-code', {})).toEqual([]);
  });

  it('adds only the fields that are set', () => {
    expect(launchDefaultArgs('claude-code', { mode: 'auto' })).toEqual([
      '--permission-mode',
      'auto',
    ]);
    expect(launchDefaultArgs('claude-code', { model: 'opus', effort: 'high' })).toEqual([
      '--model',
      'opus',
      '--effort',
      'high',
    ]);
  });

  it('uses each CLI its own flags', () => {
    expect(
      launchDefaultArgs('codex-cli', { model: 'gpt-5.6-sol', effort: 'xhigh', mode: 'auto' }),
    ).toEqual(['--model', 'gpt-5.6-sol', '-c', 'model_reasoning_effort=xhigh', '--approve-for-me']);
    expect(launchDefaultArgs('gemini-cli', { mode: 'yolo' })).toEqual(['--approval-mode', 'yolo']);
  });

  it('leaves off an effort the chosen model has no setting for', () => {
    expect(launchDefaultArgs('claude-code', { model: 'haiku', effort: 'high' })).toEqual([
      '--model',
      'haiku',
    ]);
  });

  it('keeps an effort for a model typed by hand', () => {
    expect(launchDefaultArgs('claude-code', { model: 'opus[1m]', effort: 'max' })).toEqual([
      '--model',
      'opus[1m]',
      '--effort',
      'max',
    ]);
  });

  it('never repeats what the launch already sets', () => {
    const taken = ['-m', 'sonnet', '--dangerously-skip-permissions'];
    expect(
      launchDefaultArgs('claude-code', { model: 'opus', effort: 'low', mode: 'plan' }, taken),
    ).toEqual(['--effort', 'low']);
    expect(
      launchDefaultArgs('codex-cli', { effort: 'low' }, ['-c', 'model_reasoning_effort=high']),
    ).toEqual([]);
    const parts = launchDefaultParts('claude-code', { model: 'opus' }, ['--model=haiku']);
    expect(parts).toEqual([{ kind: 'model', args: ['--model', 'opus'], applied: false }]);
  });

  it('ignores a mode the CLI does not have', () => {
    expect(launchDefaultArgs('claude-code', { mode: 'yolo' })).toEqual([]);
  });
});

describe('cliLaunchOptions', () => {
  it('lists known models and modes', () => {
    const claude = cliLaunchOptions('claude-code');
    expect(claude?.models.map((m) => m.value)).toContain('opus');
    expect(claude?.modes.map((m) => m.id)).toContain('auto');
  });

  it('returns null for unknown CLIs', () => {
    expect(cliLaunchOptions('nope')).toBeNull();
  });
});

describe('normalizeCliLaunchDefaults', () => {
  it('drops junk and empty entries', () => {
    expect(
      normalizeCliLaunchDefaults({
        'claude-code': { model: ' opus ', effort: 'turbo', mode: 'auto' },
        'codex-cli': { model: '', effort: null },
        broken: 'x',
      }),
    ).toEqual({ 'claude-code': { model: 'opus', mode: 'auto' } });
    expect(normalizeCliLaunchDefaults(null)).toEqual({});
  });
});

describe('savedArgSettings', () => {
  it('finds a model, effort, and mode set by the saved arguments', () => {
    expect(
      savedArgSettings('claude-code', [
        '--model',
        'haiku',
        '--effort=low',
        '--permission-mode',
        'plan',
      ]),
    ).toEqual([
      { kind: 'model', flag: '--model', value: 'haiku' },
      { kind: 'effort', flag: '--effort', value: 'low' },
      { kind: 'mode', flag: '--permission-mode', value: 'plan' },
    ]);
    expect(savedArgSettings('claude-code', ['-m', 'sonnet'])).toEqual([
      { kind: 'model', flag: '-m', value: 'sonnet' },
    ]);
  });

  it('reads config-style and value-less flags', () => {
    expect(savedArgSettings('codex-cli', ['-c', 'model_reasoning_effort=high', '--yolo'])).toEqual([
      { kind: 'effort', flag: '-c', value: 'model_reasoning_effort=high' },
      { kind: 'mode', flag: '--yolo' },
    ]);
  });

  it('finds nothing in arguments that set none of them', () => {
    expect(savedArgSettings('claude-code', [])).toEqual([]);
    expect(savedArgSettings('claude-code', ['--verbose', '--add-dir', 'x'])).toEqual([]);
  });
});

describe('removing a saved flag from the Arguments box', () => {
  // What the "Remove it" button in Launch defaults does with what savedArgSettings() found.
  const remove = (cliId: string, saved: string, kind: string): string => {
    const arg = savedArgSettings(cliId, parseCliArgs(saved)).find((a) => a.kind === kind);
    if (!arg?.value) throw new Error(`no ${kind} with a value in "${saved}"`);
    return configuredArgsWithout(saved, [arg.flag, arg.value]);
  };

  it('removes every spelling of the model flag and keeps the rest as written', () => {
    expect(remove('claude-code', '--model haiku', 'model')).toBe('');
    expect(remove('claude-code', '--verbose --model=haiku --add-dir "a  b"', 'model')).toBe(
      '--verbose --add-dir "a  b"',
    );
    expect(remove('claude-code', '-m sonnet --verbose', 'model')).toBe('--verbose');
  });

  it('removes an effort or mode without touching the model', () => {
    expect(remove('claude-code', '--model opus --effort low', 'effort')).toBe('--model opus');
    expect(remove('claude-code', '--permission-mode plan --model opus', 'mode')).toBe(
      '--model opus',
    );
    expect(remove('codex-cli', '-c model_reasoning_effort=high -c foo=bar', 'effort')).toBe(
      '-c foo=bar',
    );
  });

  it('leaves nothing behind that savedArgSettings would still find', () => {
    const left = remove('claude-code', '--model=haiku --verbose', 'model');
    expect(savedArgSettings('claude-code', parseCliArgs(left))).toEqual([]);
  });
});
