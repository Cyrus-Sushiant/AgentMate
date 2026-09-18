import { describe, expect, it } from 'vitest';
import { PROMPT_TYPE_PROFILES } from './promptTypeProfiles.js';
import { PROMPT_TYPES } from './types.js';

/**
 * Every profile is rendered straight into a prompt as bullet lists and a role line,
 * so an empty list would leave a heading with nothing under it, and a trailing period
 * would read wrong once the entries are joined with commas in the generation request.
 */

describe('PROMPT_TYPE_PROFILES', () => {
  it('covers every prompt type and nothing more', () => {
    expect(Object.keys(PROMPT_TYPE_PROFILES).sort()).toEqual([...PROMPT_TYPES].sort());
  });

  it('gives every profile a role label that reads after "Act as a"', () => {
    for (const type of PROMPT_TYPES) {
      const { roleLabel } = PROMPT_TYPE_PROFILES[type];
      expect(roleLabel.trim(), type).not.toBe('');
      expect(roleLabel, type).toBe(roleLabel.trim());
      expect(roleLabel, type).toMatch(/^[a-z]/);
      expect(roleLabel, type).not.toMatch(/\.$/);
    }
  });

  it('fills all three lists, since each one becomes a heading in the prompt', () => {
    for (const type of PROMPT_TYPES) {
      const profile = PROMPT_TYPE_PROFILES[type];
      expect(profile.focusAreas.length, type).toBeGreaterThan(0);
      expect(profile.requirements.length, type).toBeGreaterThan(0);
      expect(profile.bestPractices.length, type).toBeGreaterThan(0);
    }
  });

  it('keeps every entry a single trimmed line with no trailing period', () => {
    for (const type of PROMPT_TYPES) {
      const profile = PROMPT_TYPE_PROFILES[type];
      for (const entry of [
        ...profile.focusAreas,
        ...profile.requirements,
        ...profile.bestPractices,
      ]) {
        expect(entry.trim(), `${type}: ${entry}`).not.toBe('');
        expect(entry, `${type}: ${entry}`).toBe(entry.trim());
        expect(entry, `${type}: ${entry}`).not.toMatch(/[\r\n]/);
        // The entries are joined with ", " in the generation request, where a period
        // in the middle of the list reads as the end of a sentence.
        expect(entry, `${type}: ${entry}`).not.toMatch(/\.$/);
      }
    }
  });

  it('never repeats an entry inside one list', () => {
    for (const type of PROMPT_TYPES) {
      const profile = PROMPT_TYPE_PROFILES[type];
      for (const [name, list] of Object.entries({
        focusAreas: profile.focusAreas,
        requirements: profile.requirements,
        bestPractices: profile.bestPractices,
      })) {
        expect(new Set(list).size, `${type}.${name}`).toBe(list.length);
      }
    }
  });

  it('falls back to the generic engineer profile for the Custom type', () => {
    expect(PROMPT_TYPE_PROFILES.Custom.roleLabel).toBe('senior software engineer');
  });

  it('gives the specialised types a role of their own', () => {
    const generic = PROMPT_TYPE_PROFILES.Custom.roleLabel;
    const specialised = PROMPT_TYPES.filter(
      (type) => type !== 'Custom' && PROMPT_TYPE_PROFILES[type].roleLabel !== generic,
    );
    expect(specialised.length).toBe(PROMPT_TYPES.length - 1);
  });
});

describe('PROMPT_TYPES', () => {
  it('has no duplicates, since it is the picker list', () => {
    expect(new Set(PROMPT_TYPES).size).toBe(PROMPT_TYPES.length);
  });

  it('ends with Custom, the catch-all', () => {
    expect(PROMPT_TYPES[PROMPT_TYPES.length - 1]).toBe('Custom');
  });
});
