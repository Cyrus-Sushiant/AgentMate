import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, posix, sep } from 'node:path';
import {
  buildSkillAuditPrompt,
  parseSkillAuditReview,
  scanSkillFiles,
  scoreSkillFindings,
  sortFindings,
} from '@agentmat/core';
import type { SkillAuditFileInput, SkillAuditFinding } from '@agentmat/core';
import type {
  RunSkillAuditResult,
  SkillAuditRecord,
  SkillAuditSourceKind,
} from '../../shared/apiTypes';
import { runHeadlessCliPrompt } from '../cli/headlessPrompt';
import { skillAuditDb } from '../skillAuditDb';

/**
 * Reading limits. A skill is text, so anything past these is either not a skill or not something
 * a reviewer would read anyway, and the audit says so in the report rather than stalling on it.
 */
const MAX_FILES_PER_AUDIT = 40;
const MAX_BYTES_PER_FILE = 400_000;
const MAX_TOTAL_BYTES = 2_000_000;

/** Extensions that are never text, so scanning them would only produce noise. */
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.ico',
  '.icns',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.7z',
  '.rar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.mp3',
  '.mp4',
  '.mov',
  '.wav',
  '.avi',
  '.webm',
  '.psd',
  '.sqlite',
  '.db',
]);

export function isScannableFile(path: string): boolean {
  return !BINARY_EXTENSIONS.has(extname(path).toLowerCase());
}

function toPosixPath(relativePath: string): string {
  return relativePath.split(sep).join(posix.sep);
}

/** Caps a file's content and marks the cut, so a truncated scan is never mistaken for a clean one. */
function capContent(content: string): string {
  if (content.length <= MAX_BYTES_PER_FILE) return content;
  return `${content.slice(0, MAX_BYTES_PER_FILE)}\n… (file truncated by the security scan)`;
}

/** Walks an installed skill folder and returns every text file inside it. */
export async function readSkillDirFiles(skillDir: string): Promise<SkillAuditFileInput[]> {
  const files: SkillAuditFileInput[] = [];
  let totalBytes = 0;

  async function walk(dir: string, prefix: string, depth: number): Promise<void> {
    if (files.length >= MAX_FILES_PER_AUDIT || totalBytes >= MAX_TOTAL_BYTES || depth > 4) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES_PER_AUDIT || totalBytes >= MAX_TOTAL_BYTES) return;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, relativePath, depth + 1);
        continue;
      }
      // Dotfiles are included on purpose here: a payload dropped in a skill folder is more
      // likely to be hidden than a legitimate support file is.
      if (!entry.isFile() || !isScannableFile(entry.name)) continue;
      const content = await readFile(full, 'utf-8').catch(() => null);
      if (content === null) continue;
      totalBytes += content.length;
      files.push({ path: toPosixPath(relativePath), content: capContent(content) });
    }
  }

  await walk(skillDir, '', 0);
  return files;
}

export async function directoryExists(path: string): Promise<boolean> {
  return stat(path)
    .then((stats) => stats.isDirectory())
    .catch(() => false);
}

interface GithubTreeEntry {
  path: string;
  type: string;
}

/**
 * Pulls a skills.sh skill's files straight from the GitHub repo that publishes it, so a skill can
 * be checked before it is installed. Repos nest skills differently (`<name>/SKILL.md`,
 * `skills/<name>/SKILL.md`, and so on), so the tree is searched for the entry file instead of a
 * path being guessed.
 */
export async function fetchGithubSkillFiles(
  repo: string,
  skillName: string,
): Promise<SkillAuditFileInput[]> {
  const headers = { 'User-Agent': 'AgentMate', Accept: 'application/vnd.github+json' };
  const treeResponse = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`,
    { headers },
  );

  if (treeResponse.status === 403 || treeResponse.status === 429) {
    throw new Error(
      'GitHub rate-limited the request. Unauthenticated calls are capped per hour, so try again later.',
    );
  }
  if (treeResponse.status === 404) {
    throw new Error(`GitHub has no repository at ${repo}, or it is private.`);
  }
  if (!treeResponse.ok) {
    throw new Error(`Could not read ${repo} from GitHub: HTTP ${treeResponse.status}.`);
  }

  const tree = (await treeResponse.json()) as { tree?: GithubTreeEntry[] };
  const entries = (tree.tree ?? []).filter((entry) => entry.type === 'blob');
  const wanted = skillName.toLowerCase();

  const entryFile = entries.find((entry) => {
    const path = entry.path.toLowerCase();
    return path === `${wanted}/skill.md` || path.endsWith(`/${wanted}/skill.md`);
  });

  // A skill folder is the common case; a repo that ships the skill as one loose markdown file
  // (`<name>.md`) is the fallback.
  const looseFile = entryFile
    ? null
    : entries.find((entry) => {
        const path = entry.path.toLowerCase();
        return path === `${wanted}.md` || path.endsWith(`/${wanted}.md`);
      });

  if (!entryFile && !looseFile) {
    throw new Error(
      `Could not find "${skillName}" in ${repo}. The repository may have renamed or removed it.`,
    );
  }

  const paths = entryFile
    ? (() => {
        const dir = entryFile.path.slice(0, entryFile.path.lastIndexOf('/') + 1);
        return entries
          .filter((entry) => entry.path.startsWith(dir) && isScannableFile(entry.path))
          .map((entry) => entry.path)
          .slice(0, MAX_FILES_PER_AUDIT);
      })()
    : [looseFile!.path];

  const basePath = entryFile ? entryFile.path.slice(0, entryFile.path.lastIndexOf('/') + 1) : '';
  const files: SkillAuditFileInput[] = [];
  let totalBytes = 0;

  for (const path of paths) {
    if (totalBytes >= MAX_TOTAL_BYTES) break;
    const response = await fetch(
      `https://raw.githubusercontent.com/${repo}/HEAD/${path.split('/').map(encodeURIComponent).join('/')}`,
      { headers: { 'User-Agent': 'AgentMate' } },
    );
    if (!response.ok) continue;
    const content = await response.text();
    totalBytes += content.length;
    files.push({
      path: basePath && path.startsWith(basePath) ? path.slice(basePath.length) : path,
      content: capContent(content),
    });
  }

  if (files.length === 0) throw new Error(`Could not download "${skillName}" from ${repo}.`);
  return files;
}

export interface SkillAuditRunInput {
  skillId: string;
  skillName: string;
  sourceKind: SkillAuditSourceKind;
  sourceLabel: string;
  projectId: string | null;
  files: SkillAuditFileInput[];
  deepReview: boolean;
  cliId?: string | null;
  requestId?: string;
  /** Working directory for the CLI review. The CLI is told not to touch it. */
  cwd: string;
}

/**
 * Scans a skill, optionally asks an agent CLI for a second opinion, and stores the result.
 *
 * The static scan always decides the score and verdict on its own. A CLI review can add findings
 * and its own summary, and it can pull the verdict down, but it can never pull it up: a model
 * saying "looks fine" is not a reason to discard a rule that matched a real line.
 */
export async function runSkillAudit(input: SkillAuditRunInput): Promise<RunSkillAuditResult> {
  if (input.files.length === 0) {
    return { ok: false, record: null, error: 'This skill has no readable files to scan.' };
  }

  const staticFindings = scanSkillFiles(input.files);
  let findings: SkillAuditFinding[] = staticFindings;
  let cliName: string | null = null;
  let aiSummary: string | null = null;
  let aiError: string | null = null;

  if (input.deepReview) {
    const prompt = buildSkillAuditPrompt({
      skillName: input.skillName,
      sourceLabel: input.sourceLabel,
      files: input.files,
      staticFindings,
    });
    const result = await runHeadlessCliPrompt(prompt, input.cwd, {
      requestId: input.requestId,
      preferredCliId: input.cliId ?? null,
    });
    cliName = result.cliName;

    if (result.cancelled) return { ok: false, record: null, cancelled: true };

    if (!result.ok) {
      aiError = result.error ?? 'The CLI review did not return an answer.';
    } else {
      const review = parseSkillAuditReview(result.text);
      aiSummary = review.summary || null;
      findings = sortFindings([...staticFindings, ...review.findings]);
      if (review.findings.length === 0 && !review.summary) {
        aiError = `${result.cliName ?? 'The CLI'} returned an answer that could not be read as a review.`;
      }
    }
  }

  const scored = scoreSkillFindings(findings);
  const verdict = worseVerdict(scored.verdict, deepReviewVerdictFloor(findings));

  const record = skillAuditDb.add({
    skillId: input.skillId,
    skillName: input.skillName,
    sourceKind: input.sourceKind,
    sourceLabel: input.sourceLabel,
    projectId: input.projectId,
    verdict,
    score: scored.score,
    findings,
    filesScanned: input.files.length,
    bytesScanned: input.files.reduce((total, file) => total + file.content.length, 0),
    deepReview: input.deepReview,
    cliName,
    aiSummary,
    aiError,
  });

  return { ok: true, record };
}

type Verdict = SkillAuditRecord['verdict'];

const VERDICT_RANK: Record<Verdict, number> = { safe: 0, caution: 1, risky: 2, dangerous: 3 };

function worseVerdict(verdict: Verdict, other: Verdict | null): Verdict {
  if (!other) return verdict;
  return VERDICT_RANK[other] > VERDICT_RANK[verdict] ? other : verdict;
}

/**
 * A CLI finding that is worse than anything the rules caught still has to move the verdict, since
 * the score only knows about rule weights. Returns null when nothing needs raising.
 */
function deepReviewVerdictFloor(findings: SkillAuditFinding[]): Verdict | null {
  const aiFindings = findings.filter((f) => f.origin === 'ai');
  if (aiFindings.some((f) => f.severity === 'critical')) return 'dangerous';
  if (aiFindings.some((f) => f.severity === 'high')) return 'risky';
  return null;
}
