/**
 * Works out what a pasted skill location actually points at, so a skill can be checked without
 * being added as a repository or installed anywhere.
 *
 * People paste whatever they have in front of them: a folder path from Explorer, a GitHub link to
 * a subdirectory, a raw file URL, a skills.sh page, or the whole `npx skills add …` line from a
 * README. All of those name the same two things in the end, a place and (sometimes) a skill.
 */

export interface ParsedGithubSkillSource {
  kind: 'github';
  /** `owner/repo`. */
  repo: string;
  /** Branch, tag, or commit. `HEAD` when the input did not name one. */
  ref: string;
  /** Directory inside the repo the input pointed at, empty for the repository root. */
  path: string;
  /** Skill the input named outright (a skills.sh link, a `--skill` flag), when it did. */
  skillName: string | null;
}

export interface ParsedLocalSkillSource {
  kind: 'local';
  path: string;
}

export type ParsedSkillSource = ParsedGithubSkillSource | ParsedLocalSkillSource;

const OWNER_REPO = String.raw`([\w.-]+)\/([\w.-]+?)(?:\.git)?`;

/** Explorer copies paths with quotes around them, and terminals paste trailing slashes. */
function normalize(raw: string): string {
  return raw
    .trim()
    .replace(/^["'<]+|["'>]+$/g, '')
    .trim();
}

function looksLikeLocalPath(value: string): boolean {
  return (
    /^[a-zA-Z]:[\\/]/.test(value) || // C:\skills\foo
    value.startsWith('\\\\') || // UNC share
    value.startsWith('/') ||
    value.startsWith('~') ||
    value.startsWith('.')
  );
}

function toGithub(
  repo: string,
  ref: string,
  path: string,
  skillName: string | null,
): ParsedGithubSkillSource {
  return {
    kind: 'github',
    repo,
    ref: ref || 'HEAD',
    path: path.replace(/^\/+|\/+$/g, ''),
    skillName,
  };
}

/** A blob/raw link points at a file, and the skill is the folder that file sits in. */
function directoryOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

/**
 * Returns null when the input names nothing recognisable. An input that looks like a path is
 * always treated as local, so `owner/repo` shorthand can still mean GitHub without a folder
 * named that way being misread.
 */
export function parseSkillSourceInput(raw: string): ParsedSkillSource | null {
  let value = normalize(raw);
  if (!value) return null;

  // A pasted install command carries both halves: `npx skills add <url> --skill <name>`.
  let skillNameFromCommand: string | null = null;
  if (/\bskills\s+add\b/.test(value)) {
    skillNameFromCommand = value.match(/--skill[\s=]+([\w.-]+)/)?.[1] ?? null;
    const url = value.match(/https?:\/\/\S+/)?.[0];
    const shorthand = value.match(/\bskills\s+add\s+([\w.-]+\/[\w.-]+)/)?.[1];
    if (!url && !shorthand) return null;
    value = normalize(url ?? shorthand!);
  }

  if (looksLikeLocalPath(value)) return { kind: 'local', path: value.replace(/[\\/]+$/, '') };

  // skills.sh pages are `/<owner>/<repo>/<skill>`, and sometimes just `/<owner>/<repo>`.
  const skillsSh = value.match(
    new RegExp(String.raw`^https?:\/\/(?:www\.)?skills\.sh\/${OWNER_REPO}(?:\/([\w.-]+))?\/?$`, 'i'),
  );
  if (skillsSh) {
    return toGithub(
      `${skillsSh[1]}/${skillsSh[2]}`,
      'HEAD',
      '',
      skillsSh[3] ?? skillNameFromCommand,
    );
  }

  // raw.githubusercontent.com/<owner>/<repo>/<ref>/<path to a file>
  const raw2 = value.match(
    new RegExp(String.raw`^https?:\/\/raw\.githubusercontent\.com\/${OWNER_REPO}\/([^/]+)\/(.+)$`, 'i'),
  );
  if (raw2) {
    return toGithub(
      `${raw2[1]}/${raw2[2]}`,
      raw2[3],
      directoryOf(raw2[4]),
      skillNameFromCommand,
    );
  }

  // github.com/<owner>/<repo>[/tree|blob/<ref>[/<path>]]
  const github = value.match(
    new RegExp(
      String.raw`^(?:https?:\/\/)?(?:www\.)?github\.com\/${OWNER_REPO}(?:\/(tree|blob)\/([^/]+)(?:\/(.*))?)?\/?$`,
      'i',
    ),
  );
  if (github) {
    const repo = `${github[1]}/${github[2]}`;
    const kind = github[3];
    const ref = github[4] ?? 'HEAD';
    const rest = github[5] ?? '';
    // `blob` links name a file; the skill is the directory around it.
    return toGithub(repo, ref, kind === 'blob' ? directoryOf(rest) : rest, skillNameFromCommand);
  }

  // git@github.com:<owner>/<repo>.git
  const ssh = value.match(new RegExp(String.raw`^git@github\.com:${OWNER_REPO}$`, 'i'));
  if (ssh) return toGithub(`${ssh[1]}/${ssh[2]}`, 'HEAD', '', skillNameFromCommand);

  // Bare `owner/repo`, the shorthand every GitHub README uses.
  const shorthand = value.match(new RegExp(String.raw`^${OWNER_REPO}$`));
  if (shorthand) return toGithub(`${shorthand[1]}/${shorthand[2]}`, 'HEAD', '', skillNameFromCommand);

  return null;
}
