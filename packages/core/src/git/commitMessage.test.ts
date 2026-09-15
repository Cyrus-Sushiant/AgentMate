import { describe, expect, it } from 'vitest';
import {
  buildCommitMessagePrompt,
  DEFAULT_COMMIT_MESSAGE_SETTINGS,
  normalizeCommitMessageSettings,
} from './commitMessage.js';

describe('commit message prompt', () => {
  it('uses the conventional style by default', () => {
    const prompt = buildCommitMessagePrompt(DEFAULT_COMMIT_MESSAGE_SETTINGS, 'Diff: x');
    expect(prompt).toContain('Conventional Commits');
    expect(prompt).toContain('under 72 characters');
    expect(prompt.endsWith('Diff: x')).toBe(true);
  });

  it('adds the user instructions, or uses only them for custom', () => {
    const extra = buildCommitMessagePrompt(
      { ...DEFAULT_COMMIT_MESSAGE_SETTINGS, instructions: 'Mention the ticket id.' },
      'x',
    );
    expect(extra).toContain('Conventional Commits');
    expect(extra).toContain('Mention the ticket id.');

    const custom = buildCommitMessagePrompt(
      { ...DEFAULT_COMMIT_MESSAGE_SETTINGS, style: 'custom', instructions: 'Write in German.' },
      'x',
    );
    expect(custom).not.toContain('Conventional Commits');
    expect(custom).toContain('Write in German.');
  });

  it('can forbid a body', () => {
    const prompt = buildCommitMessagePrompt(
      { ...DEFAULT_COMMIT_MESSAGE_SETTINGS, includeBody: false },
      'x',
    );
    expect(prompt).toContain('only the summary line');
  });

  it('repairs stored settings', () => {
    expect(
      normalizeCommitMessageSettings({ style: 'odd', maxSubjectLength: 5, cliId: '' }),
    ).toEqual(DEFAULT_COMMIT_MESSAGE_SETTINGS);
  });
});
