import { describe, expect, it } from 'vitest';
import { parseSkillSourceInput } from './skillSource.js';

/**
 * People paste whatever they have in front of them, so this is the one place that
 * decides whether a string names a folder on disk or a place on GitHub. Reading a
 * local path as `owner/repo` would send the app off to fetch a repository that does
 * not exist, and the reverse would look for a folder that is not there.
 */

describe('parseSkillSourceInput', () => {
  it('returns null for input that names nothing', () => {
    expect(parseSkillSourceInput('')).toBeNull();
    expect(parseSkillSourceInput('   ')).toBeNull();
    expect(parseSkillSourceInput('just some words')).toBeNull();
    expect(parseSkillSourceInput('https://example.com/some/page')).toBeNull();
  });

  describe('local paths', () => {
    it('recognises a Windows drive path, in either slash direction', () => {
      expect(parseSkillSourceInput(String.raw`C:\skills\foo`)).toEqual({
        kind: 'local',
        path: String.raw`C:\skills\foo`,
      });
      expect(parseSkillSourceInput('D:/skills/foo')).toEqual({
        kind: 'local',
        path: 'D:/skills/foo',
      });
    });

    it('recognises a UNC share, a posix path, ~ and a relative path', () => {
      expect(parseSkillSourceInput(String.raw`\\server\share\skills`)?.kind).toBe('local');
      expect(parseSkillSourceInput('/home/me/skills')?.kind).toBe('local');
      expect(parseSkillSourceInput('~/skills/foo')?.kind).toBe('local');
      expect(parseSkillSourceInput('./skills/foo')?.kind).toBe('local');
    });

    it('strips the quotes Explorer adds and the trailing slash a terminal pastes', () => {
      expect(parseSkillSourceInput(`"C:\\my skills\\foo\\"`)).toEqual({
        kind: 'local',
        path: 'C:\\my skills\\foo',
      });
      expect(parseSkillSourceInput('/home/me/skills/')).toEqual({
        kind: 'local',
        path: '/home/me/skills',
      });
    });

    it('wins over the owner/repo shorthand, so a folder named that way is not misread', () => {
      expect(parseSkillSourceInput('./anthropics/skills')).toEqual({
        kind: 'local',
        path: './anthropics/skills',
      });
    });
  });

  describe('GitHub URLs', () => {
    it('reads a plain repository link, with or without the scheme, www or .git', () => {
      const expected = {
        kind: 'github',
        repo: 'anthropics/skills',
        ref: 'HEAD',
        path: '',
        skillName: null,
      };
      expect(parseSkillSourceInput('https://github.com/anthropics/skills')).toEqual(expected);
      expect(parseSkillSourceInput('http://www.github.com/anthropics/skills')).toEqual(expected);
      expect(parseSkillSourceInput('github.com/anthropics/skills')).toEqual(expected);
      expect(parseSkillSourceInput('https://github.com/anthropics/skills.git')).toEqual(expected);
      expect(parseSkillSourceInput('https://github.com/anthropics/skills/')).toEqual(expected);
    });

    it('reads a tree link as a directory on that ref', () => {
      expect(parseSkillSourceInput('https://github.com/anthropics/skills/tree/main/docx')).toEqual({
        kind: 'github',
        repo: 'anthropics/skills',
        ref: 'main',
        path: 'docx',
        skillName: null,
      });
    });

    it('reads a blob link as the directory the file sits in', () => {
      expect(
        parseSkillSourceInput('https://github.com/anthropics/skills/blob/main/docx/SKILL.md'),
      ).toEqual({
        kind: 'github',
        repo: 'anthropics/skills',
        ref: 'main',
        path: 'docx',
        skillName: null,
      });
    });

    it('leaves the path empty for a blob link on a file at the repository root', () => {
      expect(parseSkillSourceInput('https://github.com/me/repo/blob/main/SKILL.md')).toMatchObject({
        path: '',
      });
    });

    it('keeps a commit sha or a tag as the ref', () => {
      expect(parseSkillSourceInput('https://github.com/me/repo/tree/v1.2.3/skills')).toMatchObject({
        ref: 'v1.2.3',
      });
      expect(
        parseSkillSourceInput(`https://github.com/me/repo/tree/${'a'.repeat(40)}/skills`),
      ).toMatchObject({ ref: 'a'.repeat(40) });
    });

    it('reads a raw.githubusercontent.com file link', () => {
      expect(
        parseSkillSourceInput(
          'https://raw.githubusercontent.com/anthropics/skills/main/docx/SKILL.md',
        ),
      ).toEqual({
        kind: 'github',
        repo: 'anthropics/skills',
        ref: 'main',
        path: 'docx',
        skillName: null,
      });
    });

    it('reads the ssh remote form', () => {
      expect(parseSkillSourceInput('git@github.com:anthropics/skills.git')).toEqual({
        kind: 'github',
        repo: 'anthropics/skills',
        ref: 'HEAD',
        path: '',
        skillName: null,
      });
    });

    it('reads the bare owner/repo shorthand every README uses', () => {
      expect(parseSkillSourceInput('anthropics/skills')).toEqual({
        kind: 'github',
        repo: 'anthropics/skills',
        ref: 'HEAD',
        path: '',
        skillName: null,
      });
    });

    it('rejects a GitHub URL that names no repository', () => {
      expect(parseSkillSourceInput('https://github.com/anthropics')).toBeNull();
      expect(parseSkillSourceInput('https://github.com/')).toBeNull();
    });
  });

  describe('skills.sh pages', () => {
    it('reads /owner/repo/skill as a repository plus the named skill', () => {
      expect(parseSkillSourceInput('https://www.skills.sh/anthropics/skills/pdf')).toEqual({
        kind: 'github',
        repo: 'anthropics/skills',
        ref: 'HEAD',
        path: '',
        skillName: 'pdf',
      });
    });

    it('reads /owner/repo with no skill, and tolerates a trailing slash or no www', () => {
      expect(parseSkillSourceInput('https://skills.sh/anthropics/skills/')).toEqual({
        kind: 'github',
        repo: 'anthropics/skills',
        ref: 'HEAD',
        path: '',
        skillName: null,
      });
    });
  });

  describe('pasted install commands', () => {
    it('pulls the URL and the --skill flag out of a full npx line', () => {
      expect(
        parseSkillSourceInput(
          'npx skills add https://github.com/anthropics/skills --skill frontend-design',
        ),
      ).toEqual({
        kind: 'github',
        repo: 'anthropics/skills',
        ref: 'HEAD',
        path: '',
        skillName: 'frontend-design',
      });
    });

    it('accepts --skill=name as well as a space', () => {
      expect(
        parseSkillSourceInput('npx skills add https://github.com/me/repo --skill=pdf'),
      ).toMatchObject({ skillName: 'pdf' });
    });

    it('accepts the owner/repo shorthand inside the command', () => {
      expect(parseSkillSourceInput('skills add anthropics/skills --skill pdf')).toEqual({
        kind: 'github',
        repo: 'anthropics/skills',
        ref: 'HEAD',
        path: '',
        skillName: 'pdf',
      });
    });

    it('lets a skills.sh page in the command name the skill instead of the flag', () => {
      expect(
        parseSkillSourceInput('npx skills add https://www.skills.sh/anthropics/skills/pdf'),
      ).toMatchObject({ skillName: 'pdf' });
    });

    it('returns null for an install command with no location in it', () => {
      expect(parseSkillSourceInput('npx skills add --skill pdf')).toBeNull();
    });
  });

  it('never returns a github path with a leading or trailing slash', () => {
    const inputs = [
      'https://github.com/me/repo/tree/main/a/b/',
      'https://raw.githubusercontent.com/me/repo/main/a/b/SKILL.md',
    ];
    for (const input of inputs) {
      const parsed = parseSkillSourceInput(input);
      expect(parsed?.kind, input).toBe('github');
      if (parsed?.kind !== 'github') continue;
      expect(parsed.path.startsWith('/'), input).toBe(false);
      expect(parsed.path.endsWith('/'), input).toBe(false);
    }
  });

  it("always fills a ref, defaulting to 'HEAD' when the input names none", () => {
    for (const input of ['anthropics/skills', 'git@github.com:me/repo.git', 'github.com/me/repo']) {
      const parsed = parseSkillSourceInput(input);
      expect(parsed?.kind, input).toBe('github');
      if (parsed?.kind !== 'github') continue;
      expect(parsed.ref, input).toBe('HEAD');
    }
  });
});
