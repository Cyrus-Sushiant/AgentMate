import { describe, expect, it } from 'vitest';
import { CLI_REGISTRY, TARGET_AIS } from '../cli/registry.js';
import { targetAINote } from './targetAiNotes.js';

/**
 * The note is the last line of every generated prompt, and it is keyed by CLI id
 * rather than by label, so a renamed label keeps its note. An unknown agent has to
 * get the generic note rather than nothing, since the heading above it is written
 * unconditionally.
 */

const DEFAULT_NOTE = 'Be explicit about the desired outcome, constraints, and files to touch.';

describe('targetAINote', () => {
  it('resolves a note through the CLI label', () => {
    expect(targetAINote('Claude Code')).toContain('markdown structure');
  });

  it('resolves the same note through the CLI id and the legacy "Claude" label', () => {
    expect(targetAINote('claude-code')).toBe(targetAINote('Claude Code'));
    expect(targetAINote('Claude')).toBe(targetAINote('Claude Code'));
  });

  it('falls back to the generic note for an unknown agent and for empty input', () => {
    expect(targetAINote('Some Future Agent')).toBe(DEFAULT_NOTE);
    expect(targetAINote('')).toBe(DEFAULT_NOTE);
  });

  it('returns a non-empty single-paragraph note for every registered CLI', () => {
    for (const cli of CLI_REGISTRY) {
      const note = targetAINote(cli.label);
      expect(note.trim(), cli.id).not.toBe('');
      // The note is appended under a heading, so a newline would break the section.
      expect(note, cli.id).not.toMatch(/[\r\n]/);
    }
  });

  it('gives most registered CLIs a note of their own rather than the fallback', () => {
    const specific = TARGET_AIS.filter((label) => targetAINote(label) !== DEFAULT_NOTE);
    expect(specific.length).toBeGreaterThan(TARGET_AIS.length / 2);
  });

  it('is stable across calls', () => {
    expect(targetAINote('Gemini')).toBe(targetAINote('Gemini'));
  });
});
