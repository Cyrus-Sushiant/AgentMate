import { describe, expect, it } from 'vitest';
import { configuredArgsWithout, runArgsFor } from './runRecommendation.js';

describe('configuredArgsWithout', () => {
  it('drops a saved model so the picked one is used', () => {
    expect(configuredArgsWithout('--model haiku', ['--model', 'opus', '--effort', 'high'])).toBe(
      '',
    );
  });

  it('keeps every other saved argument as written', () => {
    expect(
      configuredArgsWithout('--verbose --model=haiku --effort low --add-dir "a  b"', [
        '--model',
        'opus',
        '--effort',
        'high',
      ]),
    ).toBe('--verbose --add-dir "a  b"');
  });

  it('treats -m as --model', () => {
    expect(configuredArgsWithout('-m gpt-6-luna --full-auto', ['--model', 'gpt-6-sol'])).toBe(
      '--full-auto',
    );
  });

  it('drops only the -c keys the run sets', () => {
    expect(
      configuredArgsWithout('-c model_reasoning_effort=low -c sandbox_mode=workspace-write', [
        '-c',
        'model_reasoning_effort=high',
      ]),
    ).toBe('-c sandbox_mode=workspace-write');
  });

  it('does not eat a following flag when the saved flag has no value', () => {
    expect(configuredArgsWithout('--model --verbose', ['--model', 'opus'])).toBe('--verbose');
  });

  it('leaves the saved arguments alone when there is nothing to override', () => {
    expect(configuredArgsWithout('--model haiku', [])).toBe('--model haiku');
  });
});

describe('runArgsFor', () => {
  it("passes the picked model and effort in the CLI's own flags", () => {
    expect(runArgsFor('claude-code', 'opus', 'high')).toEqual([
      '--model',
      'opus',
      '--effort',
      'high',
    ]);
    expect(runArgsFor('codex-cli', 'luna', 'low')).toEqual([
      '--model',
      'gpt-6-luna',
      '-c',
      'model_reasoning_effort=low',
    ]);
  });

  it('drops an effort the model has no setting for', () => {
    expect(runArgsFor('claude-code', 'haiku', 'high')).toEqual(['--model', 'haiku']);
  });

  it('adds nothing when no model was picked or the model is unknown', () => {
    expect(runArgsFor('claude-code', null, 'high')).toEqual([]);
    expect(runArgsFor('claude-code', 'not-a-model', 'high')).toEqual([]);
    expect(runArgsFor(null, 'opus', 'high')).toEqual([]);
  });
});
