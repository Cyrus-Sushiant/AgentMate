import { describe, expect, it } from 'vitest';
import {
  bundledSkillsShDirectory,
  SKILLS_SH_PSEUDO_REPOSITORY_ID,
  SKILLS_SH_SNAPSHOT_DATE,
  SKILLS_SH_VERIFIED_OWNERS,
} from './skillsSh.js';

/**
 * This catalog is a snapshot of thousands of skills, so the entries themselves are
 * not worth asserting one by one. What matters is that every row is still usable:
 * a unique id the installed-skills store can key on, an install command the CLI can
 * run, and an `official` flag that reflects the verified-owner list rather than a
 * judgement typed into an individual row.
 */

describe('bundledSkillsShDirectory', () => {
  const entries = bundledSkillsShDirectory;

  it('is populated, since it is what the directory shows offline', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const ids = entries.map((entry) => entry.id);
    const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    expect(duplicates).toEqual([]);
  });

  it('shapes every id as owner/repo/skillName, matching its own parts', () => {
    for (const entry of entries) {
      // A skill nested inside a plugin keeps its subdirectory (and sometimes a
      // namespace colon) in the name, so only the owner/repo half has a fixed shape.
      expect(entry.id, entry.id).toBe(`${entry.repo}/${entry.name}`);
      expect(entry.name, entry.id).not.toMatch(/\s/);
      expect(entry.repo, entry.id).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(entry.repo.startsWith(`${entry.owner}/`), entry.id).toBe(true);
    }
  });

  it('gives every entry a name and a description for the card', () => {
    for (const entry of entries) {
      expect(entry.name.trim(), entry.id).not.toBe('');
      expect(entry.description.trim(), entry.id).not.toBe('');
    }
  });

  it('derives `official` from the verified-owner list and nothing else', () => {
    const verified = new Set(SKILLS_SH_VERIFIED_OWNERS);
    for (const entry of entries) {
      expect(entry.official, entry.id).toBe(verified.has(entry.owner));
    }
  });

  it('points every detail URL at the entry it belongs to', () => {
    for (const entry of entries) {
      expect(entry.url, entry.id).toBe(`https://www.skills.sh/${entry.id}`);
    }
  });

  it('builds an install command the skills CLI can actually run', () => {
    for (const entry of entries) {
      expect(entry.installCommand, entry.id).toBe(
        `npx skills add https://github.com/${entry.repo} --skill ${entry.name}`,
      );
    }
  });

  it('labels installs in the compact form skills.sh uses', () => {
    for (const entry of entries) {
      expect(entry.installsLabel, entry.id).toMatch(/^\d+(\.\d+)?[KM]?$/);
    }
  });

  it('never carries a newline in a field the UI renders on one line', () => {
    for (const entry of entries) {
      for (const field of [entry.name, entry.installsLabel, entry.url, entry.installCommand]) {
        expect(field, entry.id).not.toMatch(/[\r\n]/);
      }
    }
  });
});

describe('SKILLS_SH_VERIFIED_OWNERS', () => {
  it('lists unique, lowercase owner handles', () => {
    expect(new Set(SKILLS_SH_VERIFIED_OWNERS).size).toBe(SKILLS_SH_VERIFIED_OWNERS.length);
    for (const owner of SKILLS_SH_VERIFIED_OWNERS) {
      expect(owner, owner).toBe(owner.toLowerCase());
      expect(owner, owner).toMatch(/^[\w.-]+$/);
    }
  });

  it('is sorted, which is how the list is maintained against the site', () => {
    expect([...SKILLS_SH_VERIFIED_OWNERS]).toEqual([...SKILLS_SH_VERIFIED_OWNERS].sort());
  });
});

describe('snapshot metadata', () => {
  it('records a parseable snapshot date', () => {
    expect(SKILLS_SH_SNAPSHOT_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(SKILLS_SH_SNAPSHOT_DATE))).toBe(false);
  });

  it('keeps a pseudo repository id, so these are told apart from user-added repositories', () => {
    expect(SKILLS_SH_PSEUDO_REPOSITORY_ID.trim()).not.toBe('');
  });
});
