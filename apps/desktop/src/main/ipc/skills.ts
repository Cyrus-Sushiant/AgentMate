import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { app, dialog, ipcMain } from 'electron';
import {
  isUiProAiTarget,
  parseRepositoryIndex,
  SKILLS_SH_PSEUDO_REPOSITORY_ID,
  SKILLS_SH_VERIFIED_OWNERS,
  UI_UX_PRO_MAX_PSEUDO_REPOSITORY_ID,
  UI_UX_PRO_MAX_SKILL_ID,
} from '@agentmat/core';
import type {
  Skill,
  SkillRepository,
  SkillRepositoryIndex,
  SkillRepositorySourceType,
} from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type {
  InstallFromSkillsShInput,
  InstalledSkillRecord,
  RecordUiProInstallInput,
  SkillsShDetail,
  SkillsShSearchResult,
  SkillUpdateInfo,
  UiProPrerequisites,
  UiProToolProbe,
} from '../../shared/apiTypes';
import { store } from '../store';

const SKILLS_SH_VERIFIED_OWNER_SET = new Set(SKILLS_SH_VERIFIED_OWNERS);

const execFileAsync = promisify(execFile);

function repoCacheDir(repositoryId: string): string {
  return join(app.getPath('userData'), 'skill-repo-cache', repositoryId);
}

function installedSkillsFilePath(projectFolderPath: string): string {
  return join(projectFolderPath, '.agentmate', 'installed-skills.json');
}

/** ~/.claude is the scope root for globally-installed skills, mirroring Claude Code's own global skills dir. */
function globalSkillsScopeRoot(): string {
  return join(app.getPath('home'), '.claude');
}

/** Resolves where a skill install/list/remove should read and write: a project's folder, or the global scope for null. */
async function resolveSkillScopeRoot(projectId: string | null): Promise<string> {
  if (projectId === null) return globalSkillsScopeRoot();
  const projects = await store.getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project.folderPath;
}

// GitHub owner/repo and skill directory names are restricted to this character set. Validating
// against it before shelling out means the values can never carry shell metacharacters.
const GITHUB_REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const SKILL_NAME_PATTERN = /^[\w.-]+$/;

const ANSI_ESCAPE_PATTERN = new RegExp('\\x1b\\[[?]?[0-9;]*[a-zA-Z]', 'g');

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, '').replace(/\r/g, '').trim();
}

/**
 * Runs the real `skills` CLI (skills.sh's own installer) instead of hand-rolling GitHub tree
 * traversal, since repos vary in where they nest a skill's folder. `npx` is a `.cmd` shim on
 * Windows, which `execFile` can't launch without a shell; the args are validated by the caller
 * against `GITHUB_REPO_PATTERN`/`SKILL_NAME_PATTERN` first, so enabling the shell there is safe.
 */
async function runSkillsCli(args: string[], cwd: string): Promise<void> {
  try {
    await execFileAsync('npx', args, { cwd, shell: process.platform === 'win32' });
  } catch (error) {
    const stderr = (error as NodeJS.ErrnoException & { stderr?: string }).stderr;
    const message = stderr?.trim() || (error instanceof Error ? error.message : String(error));
    throw new Error(stripAnsi(message));
  }
}

const PROBE_TIMEOUT_MS = 8000;

/** Runs a command purely to see whether it resolves, mirroring the probe in tools.ts. */
async function probeCommand(command: string, args: string[]): Promise<string | null> {
  try {
    // npm-installed CLIs are .cmd shims on Windows, which Node refuses to spawn directly, so
    // route through cmd.exe with a static argv array.
    const { stdout } =
      process.platform === 'win32'
        ? await execFileAsync('cmd.exe', ['/d', '/s', '/c', command, ...args], {
            timeout: PROBE_TIMEOUT_MS,
            windowsHide: true,
          })
        : await execFileAsync(command, args, { timeout: PROBE_TIMEOUT_MS, windowsHide: true });
    return stdout.trim();
  } catch {
    return null;
  }
}

function toProbe(output: string | null): UiProToolProbe {
  return { found: output !== null, version: output?.match(/\d+\.\d+(\.\d+)?[\w.-]*/)?.[0] ?? null };
}

/**
 * Python 3 answers to `python3` on most systems and to `python` on Windows. The version string is
 * matched rather than just the exit code, since Windows ships a `python` alias that opens the
 * Microsoft Store instead of running anything.
 */
async function probePython(): Promise<{ probe: UiProToolProbe; command: string | null }> {
  for (const command of ['python3', 'python']) {
    const output = await probeCommand(command, ['--version']);
    if (output && /Python 3\./.test(output)) return { probe: toProbe(output), command };
  }
  return { probe: { found: false, version: null }, command: null };
}

async function readInstalledSkills(projectFolderPath: string): Promise<InstalledSkillRecord[]> {
  try {
    const raw = await readFile(installedSkillsFilePath(projectFolderPath), 'utf-8');
    return JSON.parse(raw) as InstalledSkillRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function writeInstalledSkills(
  projectFolderPath: string,
  records: InstalledSkillRecord[],
): Promise<void> {
  const filePath = installedSkillsFilePath(projectFolderPath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

/** Resolves a repository's index and the base directory/URL its skill file paths are relative to. */
async function loadRepositoryIndex(
  repo: SkillRepository,
): Promise<{ index: SkillRepositoryIndex; baseDir: string | null; baseUrl: string | null }> {
  if (repo.sourceType === 'local-folder') {
    const raw = await readFile(join(repo.source, 'repository.json'), 'utf-8');
    return { index: parseRepositoryIndex(JSON.parse(raw)), baseDir: repo.source, baseUrl: null };
  }

  if (repo.sourceType === 'git') {
    const cacheDir = repoCacheDir(repo.id);
    const alreadyCloned = await readFile(join(cacheDir, 'repository.json'), 'utf-8')
      .then(() => true)
      .catch(() => false);
    if (!alreadyCloned) {
      await mkdir(dirname(cacheDir), { recursive: true });
      await execFileAsync('git', ['clone', '--depth=1', repo.source, cacheDir]);
    } else {
      await execFileAsync('git', ['-C', cacheDir, 'pull', '--ff-only']).catch(() => undefined);
    }
    const raw = await readFile(join(cacheDir, 'repository.json'), 'utf-8');
    return { index: parseRepositoryIndex(JSON.parse(raw)), baseDir: cacheDir, baseUrl: null };
  }

  // 'url'
  const response = await fetch(repo.source);
  if (!response.ok) throw new Error(`Failed to fetch repository index: HTTP ${response.status}`);
  const json = await response.json();
  return {
    index: parseRepositoryIndex(json),
    baseDir: null,
    baseUrl: repo.source,
  };
}

async function readSkillFileContent(
  file: Skill['files'][number],
  ctx: { baseDir: string | null; baseUrl: string | null },
): Promise<string> {
  if (ctx.baseDir) {
    return readFile(join(ctx.baseDir, file.url), 'utf-8');
  }
  const absoluteUrl = ctx.baseUrl ? new URL(file.url, ctx.baseUrl).toString() : file.url;
  const response = await fetch(absoluteUrl);
  if (!response.ok) throw new Error(`Failed to fetch skill file: HTTP ${response.status}`);
  return response.text();
}


export function registerSkillHandlers(): void {
  ipcMain.handle(
    IPC.skills.listRepositories,
    (): Promise<SkillRepository[]> => store.getRepositories(),
  );

  ipcMain.handle(
    IPC.skills.addRepository,
    async (
      _event,
      input: { name: string; sourceType: SkillRepositorySourceType; source: string },
    ): Promise<SkillRepository> => {
      const repo: SkillRepository = {
        id: randomUUID(),
        name: input.name,
        sourceType: input.sourceType,
        source: input.source,
        addedAt: new Date().toISOString(),
        lastRefreshedAt: null,
      };
      await loadRepositoryIndex(repo);
      const repos = await store.getRepositories();
      repos.unshift({ ...repo, lastRefreshedAt: new Date().toISOString() });
      await store.setRepositories(repos);
      return repo;
    },
  );

  ipcMain.handle(
    IPC.skills.removeRepository,
    async (_event, repositoryId: string): Promise<void> => {
      const repos = await store.getRepositories();
      await store.setRepositories(repos.filter((r) => r.id !== repositoryId));
      await rm(repoCacheDir(repositoryId), { recursive: true, force: true });
    },
  );

  ipcMain.handle(
    IPC.skills.refreshRepository,
    async (_event, repositoryId: string): Promise<SkillRepositoryIndex> => {
      const repos = await store.getRepositories();
      const repo = repos.find((r) => r.id === repositoryId);
      if (!repo) throw new Error(`Repository ${repositoryId} not found`);
      if (repo.sourceType === 'git') {
        await rm(repoCacheDir(repositoryId), { recursive: true, force: true });
      }
      const { index } = await loadRepositoryIndex(repo);
      repo.lastRefreshedAt = new Date().toISOString();
      await store.setRepositories(repos);
      return index;
    },
  );

  ipcMain.handle(
    IPC.skills.getRepositoryIndex,
    async (_event, repositoryId: string): Promise<SkillRepositoryIndex> => {
      const repos = await store.getRepositories();
      const repo = repos.find((r) => r.id === repositoryId);
      if (!repo) throw new Error(`Repository ${repositoryId} not found`);
      const { index } = await loadRepositoryIndex(repo);
      return index;
    },
  );

  ipcMain.handle(IPC.skills.pickLocalRepository, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    IPC.skills.install,
    async (
      _event,
      params: { projectId: string | null; repositoryId: string; skillId: string },
    ): Promise<void> => {
      const [scopeRoot, repos] = await Promise.all([
        resolveSkillScopeRoot(params.projectId),
        store.getRepositories(),
      ]);
      const repo = repos.find((r) => r.id === params.repositoryId);
      if (!repo) throw new Error(`Repository ${params.repositoryId} not found`);

      const { index, baseDir, baseUrl } = await loadRepositoryIndex(repo);
      const skill = index.skills.find((s) => s.id === params.skillId);
      if (!skill) throw new Error(`Skill ${params.skillId} not found in repository ${repo.name}`);

      const skillDir = join(scopeRoot, 'skills', skill.id);
      for (const file of skill.files) {
        const content = await readSkillFileContent(file, { baseDir, baseUrl });
        const targetPath = join(skillDir, file.path);
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, content, 'utf-8');
      }

      const installed = await readInstalledSkills(scopeRoot);
      const withoutExisting = installed.filter((s) => s.skillId !== skill.id);
      withoutExisting.push({
        skillId: skill.id,
        repositoryId: repo.id,
        version: skill.version,
        installedAt: new Date().toISOString(),
      });
      await writeInstalledSkills(scopeRoot, withoutExisting);
    },
  );

  ipcMain.handle(
    IPC.skills.remove,
    async (_event, params: { projectId: string | null; skillId: string }): Promise<void> => {
      const scopeRoot = await resolveSkillScopeRoot(params.projectId);
      const installed = await readInstalledSkills(scopeRoot);
      const record = installed.find((s) => s.skillId === params.skillId);

      if (record?.repositoryId === UI_UX_PRO_MAX_PSEUDO_REPOSITORY_ID) {
        // Nothing to delete here: `uipro uninstall` owns the files it wrote, and the renderer
        // runs it in a visible terminal (it prints what it removed and can ask for a platform).
        // This handler only drops AgentMate's own bookkeeping entry.
      } else if (record?.repositoryId === SKILLS_SH_PSEUDO_REPOSITORY_ID) {
        const skillName = params.skillId.split('/').pop() ?? params.skillId;
        if (SKILL_NAME_PATTERN.test(skillName)) {
          const agents = (record.agents ?? []).filter((a) => SKILL_NAME_PATTERN.test(a));
          const args = [
            'skills',
            'remove',
            skillName,
            '--agent',
            ...(agents.length > 0 ? agents : ['*']),
            '-y',
          ];
          if (params.projectId === null) args.push('--global');
          await runSkillsCli(args, scopeRoot);
        }
      } else {
        await rm(join(scopeRoot, 'skills', params.skillId), {
          recursive: true,
          force: true,
        });
      }

      await writeInstalledSkills(
        scopeRoot,
        installed.filter((s) => s.skillId !== params.skillId),
      );
    },
  );

  ipcMain.handle(
    IPC.skills.listInstalled,
    async (_event, projectId: string | null): Promise<InstalledSkillRecord[]> => {
      const scopeRoot = await resolveSkillScopeRoot(projectId);
      return readInstalledSkills(scopeRoot);
    },
  );

  ipcMain.handle(
    IPC.skills.checkForUpdates,
    async (_event, projectId: string | null): Promise<SkillUpdateInfo[]> => {
      const scopeRoot = await resolveSkillScopeRoot(projectId);

      const installed = await readInstalledSkills(scopeRoot);
      const repos = await store.getRepositories();
      const indexCache = new Map<string, SkillRepositoryIndex>();
      const updates: SkillUpdateInfo[] = [];

      for (const record of installed) {
        if (record.repositoryId === SKILLS_SH_PSEUDO_REPOSITORY_ID) continue;
        const repo = repos.find((r) => r.id === record.repositoryId);
        if (!repo) continue;

        let index = indexCache.get(repo.id);
        if (!index) {
          try {
            index = (await loadRepositoryIndex(repo)).index;
          } catch {
            continue;
          }
          indexCache.set(repo.id, index);
        }

        const current = index.skills.find((s) => s.id === record.skillId);
        if (!current) continue;
        updates.push({
          skillId: record.skillId,
          repositoryId: repo.id,
          currentVersion: record.version,
          latestVersion: current.version,
          hasUpdate: current.version !== record.version,
        });
      }

      return updates;
    },
  );

  ipcMain.handle(
    IPC.skills.searchSkillsSh,
    async (_event, query: string): Promise<SkillsShSearchResult[]> => {
      const trimmed = query.trim();
      if (trimmed.length < 2) return [];
      const response = await fetch(
        `https://www.skills.sh/api/search?q=${encodeURIComponent(trimmed)}`,
        { headers: { 'User-Agent': 'AgentMate' } },
      );
      if (!response.ok) throw new Error(`skills.sh search failed: HTTP ${response.status}`);
      const json = (await response.json()) as {
        skills?: { id: string; skillId: string; source: string; installs: number }[];
      };
      return (json.skills ?? []).map((s) => {
        const owner = s.source.split('/')[0];
        return {
          id: s.id,
          name: s.skillId,
          owner,
          repo: s.source,
          installs: s.installs,
          official: SKILLS_SH_VERIFIED_OWNER_SET.has(owner),
          url: `https://www.skills.sh/${s.id}`,
          installCommand: `npx skills add https://github.com/${s.source} --skill ${s.skillId}`,
        };
      });
    },
  );

  ipcMain.handle(
    IPC.skills.getSkillsShDetail,
    async (_event, skillPath: string): Promise<SkillsShDetail> => {
      const response = await fetch(`https://www.skills.sh/${skillPath}`, {
        headers: { 'User-Agent': 'AgentMate' },
      });
      if (!response.ok) throw new Error(`skills.sh fetch failed: HTTP ${response.status}`);
      const html = await response.text();
      const ldMatch = html.match(
        /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"SoftwareApplication".*?\})<\/script>/,
      );
      let description: string | null = null;
      if (ldMatch) {
        try {
          description = (JSON.parse(ldMatch[1]) as { description?: string }).description ?? null;
        } catch {
          description = null;
        }
      }
      const installsMatch = html.match(
        /<span>Installs<\/span><\/div><div class="text-3xl[^"]*">([^<]+)<\/div>/,
      );
      return { description, installsLabel: installsMatch?.[1] ?? null };
    },
  );

  // The actual `skills add` command now runs in a visible terminal (opened from the renderer)
  // instead of a detached child process, since it can prompt for confirmation or a choice partway
  // through. This handler just records the install in AgentMate's own bookkeeping once the
  // renderer has opened that terminal, so the skill shows up in the installed-skills lists.
  ipcMain.handle(
    IPC.skills.recordSkillsShInstall,
    async (_event, params: InstallFromSkillsShInput): Promise<void> => {
      if (!GITHUB_REPO_PATTERN.test(params.repo)) {
        throw new Error(`Invalid repository: ${params.repo}`);
      }
      if (!SKILL_NAME_PATTERN.test(params.skillName)) {
        throw new Error(`Invalid skill name: ${params.skillName}`);
      }

      const scopeRoot = await resolveSkillScopeRoot(params.projectId);
      await mkdir(scopeRoot, { recursive: true });

      const agents = params.agents.filter((a) => SKILL_NAME_PATTERN.test(a));
      const skillId = `${params.repo}/${params.skillName}`;
      const installed = await readInstalledSkills(scopeRoot);
      const withoutExisting = installed.filter((s) => s.skillId !== skillId);
      withoutExisting.push({
        skillId,
        repositoryId: SKILLS_SH_PSEUDO_REPOSITORY_ID,
        version: new Date().toISOString().slice(0, 10),
        installedAt: new Date().toISOString(),
        agents,
      });
      await writeInstalledSkills(scopeRoot, withoutExisting);
    },
  );

  ipcMain.handle(
    IPC.skills.checkUiProPrerequisites,
    async (): Promise<UiProPrerequisites> => {
      const [node, npm, python, uipro] = await Promise.all([
        probeCommand('node', ['--version']),
        probeCommand('npm', ['--version']),
        probePython(),
        probeCommand('uipro', ['--version']),
      ]);
      return {
        node: toProbe(node),
        npm: toProbe(npm),
        python: python.probe,
        pythonCommand: python.command,
        uipro: toProbe(uipro),
      };
    },
  );

  // Like the skills.sh flow, `uipro init` runs in a visible terminal opened by the renderer,
  // since it prints the files it writes and can prompt. This only records the install so the
  // skill shows up in AgentMate's installed lists.
  ipcMain.handle(
    IPC.skills.recordUiProInstall,
    async (_event, params: RecordUiProInstallInput): Promise<void> => {
      const agents = params.agents.filter(isUiProAiTarget);
      if (agents.length === 0) throw new Error('No valid assistant selected.');

      const scopeRoot = await resolveSkillScopeRoot(params.projectId);
      await mkdir(scopeRoot, { recursive: true });

      const installed = await readInstalledSkills(scopeRoot);
      const existing = installed.find((s) => s.skillId === UI_UX_PRO_MAX_SKILL_ID);
      // Installing for a second assistant adds to the record instead of replacing it, since the
      // earlier assistant's files are still on disk.
      const mergedAgents = [...new Set([...(existing?.agents ?? []), ...agents])];

      await writeInstalledSkills(scopeRoot, [
        ...installed.filter((s) => s.skillId !== UI_UX_PRO_MAX_SKILL_ID),
        {
          skillId: UI_UX_PRO_MAX_SKILL_ID,
          repositoryId: UI_UX_PRO_MAX_PSEUDO_REPOSITORY_ID,
          version: new Date().toISOString().slice(0, 10),
          installedAt: new Date().toISOString(),
          agents: mergedAgents,
          installMethod: params.method,
        },
      ]);
    },
  );
}
