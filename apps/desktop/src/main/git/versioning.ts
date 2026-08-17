const MAX_RELEASE_LOG_LINES = 120;
const MAX_FALLBACK_BULLETS = 20;
const MAX_TAG_MESSAGE_CHARS = 2000;

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  /** Set for pre-releases like 1.7.0-rc.1, which sort below the plain 1.7.0. */
  prerelease: string | null;
}

export interface SuggestedTag {
  tag: string;
  reason?: string;
  message?: string;
}

export type BumpKind = 'major' | 'minor' | 'patch';

/** Commit log (and diff size) since the last tag, meant to be dropped into an AI prompt. */
export function buildReleaseSummary(
  latestTag: string | null,
  subjects: string[],
  diffStat: string,
): string {
  const shown = subjects.slice(0, MAX_RELEASE_LOG_LINES).map((subject) => `- ${subject}`);
  if (subjects.length > shown.length) {
    shown.push(`- … and ${subjects.length - shown.length} more commits`);
  }

  return [
    `Latest existing tag: ${latestTag ?? '(none, this would be the first tag)'}`,
    `Commits since then:\n${shown.join('\n') || '(none)'}`,
    diffStat ? `Diff size: ${diffStat}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Release notes built straight from the commit log. Used whenever the CLI answers with a
 * version but no usable notes, so the tag message field is never left empty.
 */
export function fallbackTagMessage(tag: string, subjects: string[]): string {
  const shown = subjects.slice(0, MAX_FALLBACK_BULLETS).map((subject) => `- ${subject}`);
  if (subjects.length > shown.length) {
    shown.push(`- … and ${subjects.length - shown.length} more commits`);
  }
  return [`Release ${tag}`, '', ...shown].join('\n').trim();
}

/** Drops markdown fences and stray backticks that agent CLIs like to wrap answers in. */
function stripMarkdownFences(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim();
}

/** Keeps the repo's own `v` prefix style rather than whatever the model emitted. */
export function formatTagForRepo(version: string, latestTag: string | null): string {
  const wantsPrefix = latestTag ? latestTag.startsWith('v') : true;
  if (wantsPrefix && !version.startsWith('v')) return `v${version}`;
  if (!wantsPrefix && version.startsWith('v')) return version.slice(1);
  return version;
}

/**
 * Models often answer `TAG: patch` (or minor/major) instead of a concrete semver.
 * That still tells us which component to bump when we already know the latest tag.
 */
export function parseBumpKind(text: string): BumpKind | null {
  const tagLine = text.match(/^\s*TAG:\s*(.+)$/im)?.[1]?.trim() ?? '';
  // Only trust the TAG line so a NOTES sentence mentioning "major refactor" doesn't bump major.
  const word = tagLine.match(/\b(major|minor|patch)\b/i)?.[1]?.toLowerCase();
  if (word === 'major' || word === 'minor' || word === 'patch') return word;
  return null;
}

export function bumpVersion(latest: SemverParts, kind: BumpKind): string {
  if (kind === 'major') return `${latest.major + 1}.0.0`;
  if (kind === 'minor') return `${latest.major}.${latest.minor + 1}.0`;
  return `${latest.major}.${latest.minor}.${latest.patch + 1}`;
}

export function extractTagNotes(text: string): { reason?: string; message?: string } {
  const reason = text
    .match(/^\s*WHY:\s*(.+)$/im)?.[1]
    ?.trim()
    .slice(0, 240);

  // NOTES is the last field, so everything after its header belongs to it. When the CLI
  // skipped the header, keep any bullet list it wrote instead, but not loose prose, which
  // is usually preamble rather than release notes.
  const headed = text.match(/^[ \t]*NOTES:[ \t]*\r?\n?([\s\S]*)$/im)?.[1];
  const bulletsOnly = stripMarkdownFences(text)
    .split('\n')
    .filter((line) => /^\s*[-*•]\s+\S/.test(line))
    .join('\n');
  const notes = stripMarkdownFences(headed ?? bulletsOnly).slice(0, MAX_TAG_MESSAGE_CHARS);

  return { reason: reason || undefined, message: notes || undefined };
}

const SEMVER_IN_TEXT = /v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/;

/**
 * Pulls the tag, the rationale and the release notes out of the CLI's answer,
 * tolerating chatter around the requested TAG/WHY/NOTES format.
 *
 * Only the TAG line is searched for the version. Scanning the whole answer used to
 * pick up a dependency version quoted in the NOTES section, and because such a
 * number is usually far above the repo's own, the "must be newer" guard downstream
 * waved it through instead of rejecting it. A TAG line with no digits (`TAG: patch`)
 * returns null so the caller falls back to the commit history.
 */
export function parseSuggestedTag(text: string, latestTag: string | null): SuggestedTag | null {
  const tagLine = text.match(/^\s*TAG:\s*(.+)$/im)?.[1];
  const match = tagLine?.match(SEMVER_IN_TEXT);
  if (!match) return null;

  const tag = formatTagForRepo(match[0], latestTag);
  const { reason, message } = extractTagNotes(text);
  return { tag, reason, message };
}

export function parseSemver(tag: string): SemverParts | null {
  const match = tag.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] ?? null,
  };
}

/** Positive when `a` is newer than `b`. */
export function compareSemver(a: SemverParts, b: SemverParts): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

/**
 * The next version worked out from the commit subjects alone, using conventional-commit
 * markers: a `!` or BREAKING CHANGE means major, a `feat` means minor, anything else patch.
 * This is the safety net for when the CLI answers with a version that isn't actually a bump
 * of the latest tag, which models do surprisingly often (a stock "1.2.3", say).
 */
export function deriveNextVersion(latest: SemverParts, subjects: string[]): string {
  const isBreaking = subjects.some(
    (s) => /^[a-z]+(\([^)]*\))?!:/i.test(s) || /BREAKING[ -]CHANGE/i.test(s),
  );
  const hasFeature = subjects.some((s) => /^feat(\([^)]*\))?:/i.test(s));
  return bumpVersion(latest, isBreaking ? 'major' : hasFeature ? 'minor' : 'patch');
}

/**
 * Why a model's version was thrown away, phrased to read after "which", or null when it
 * is usable. A suggestion has to be strictly newer than the latest tag and no more than
 * one major ahead: a jump past that is a made-up number rather than a bump of this repo.
 */
export function rejectSuggestedVersion(
  suggested: SemverParts | null,
  latest: SemverParts,
  latestTag: string,
): string | null {
  if (!suggested) return 'is not a version number';
  if (compareSemver(suggested, latest) <= 0) return `isn't newer than ${latestTag}`;
  if (suggested.major > latest.major + 1) {
    return `jumps more than one major version past ${latestTag}`;
  }
  return null;
}

/** Prompt handed to the agent CLI to roll a new version number through the project's files. */
export function buildVersionBumpPrompt(tag: string): string {
  const version = tag.replace(/^v/, '');
  return [
    `Update this project's version to ${version}.`,
    '',
    '- Set the version field in every manifest this repo actually uses: package.json (including',
    '  workspace packages), pyproject.toml, Cargo.toml, *.csproj, app.json, build.gradle,',
    '  Info.plist, and so on.',
    '- Update hard-coded version strings the application itself displays (about screens, footers,',
    '  constants such as APP_VERSION).',
    '- Leave lockfiles alone. Only touch a CHANGELOG if this project clearly keeps one.',
    '- Edit the version fields directly. Do not run `npm version`, `yarn version`, `pnpm version`,',
    '  `cargo release`, or any other command that bumps a version by itself, since those also',
    "  create a commit and a git tag. Do not commit, tag or push anything; that's handled separately.",
    '',
    'When you are done, reply with a short plain-text summary: one line per file you changed,',
    'as "path: old version -> new version". No markdown.',
  ].join('\n');
}
