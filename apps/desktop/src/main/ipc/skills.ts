import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { watch, type FSWatcher } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import {
  allProjectSkillRemoveDirs,
  isUiProAiTarget,
  KNOWN_AGENT_DIRS,
  parseRepositoryIndex,
  resolveProjectSkillInstallDirs,
  SKILLS_SH_PSEUDO_REPOSITORY_ID,
  SKILLS_SH_VERIFIED_OWNERS,
  UI_UX_PRO_MAX_PSEUDO_REPOSITORY_ID,
  UI_UX_PRO_MAX_SKILL_ID,
} from '@agentmat/core';
import type {
  AgentType,
  Skill,
  SkillRepository,
  SkillRepositoryIndex,
  SkillRepositorySourceType,
} from '@agentmat/core';
import { IPC } from '../../shared/ipcChannels';
import type {
  InstallFromSkillsShInput,
  InstalledSkillRecord,
  LocalSkillFolderPreview,
  RecordUiProInstallInput,
  SkillsShDetail,
  SkillsShSearchResult,
  SkillUpdateInfo,
  UiProPrerequisites,
  UiProToolProbe,
} from '../../shared/apiTypes';
import { scanSkillFolder } from '../skills/localFolderIndex';
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

type SkillScope = {
  /** Project folder, or ~/.claude for a global install. */
  scopeRoot: string;
  /** Null when installing globally (always under ~/.claude/skills). */
  agentType: AgentType | null;
};

/** Resolves where a skill install/list/remove should read and write: a project's folder, or the global scope for null. */
async function resolveSkillScope(projectId: string | null): Promise<SkillScope> {
  if (projectId === null) return { scopeRoot: globalSkillsScopeRoot(), agentType: null };
  const projects = await store.getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return { scopeRoot: project.folderPath, agentType: project.agentType };
}

async function resolveSkillScopeRoot(projectId: string | null): Promise<string> {
  return (await resolveSkillScope(projectId)).scopeRoot;
}

/**
 * Absolute dirs to copy a repo/local skill into. Global installs stay under ~/.claude/skills.
 * Project installs go into the skills folder of whichever agent dirs already exist
 * (.claude, .agents, .codex, …), falling back to the project's agentType convention.
 */
async function resolveSkillInstallDirs(scope: SkillScope): Promise<string[]> {
  if (scope.agentType === null) {
    return [join(scope.scopeRoot, 'skills')];
  }

  const existingAgentDirs: string[] = [];
  for (const agentDir of KNOWN_AGENT_DIRS) {
    if (await directoryExists(join(scope.scopeRoot, agentDir))) {
      existingAgentDirs.push(agentDir);
    }
  }

  return resolveProjectSkillInstallDirs(scope.agentType, existingAgentDirs).map((relative) =>
    join(scope.scopeRoot, ...relative.split('/')),
  );
}

/** Absolute dirs to delete when removing a repo/local skill (covers agent dirs and legacy root skills/). */
function resolveSkillRemoveDirs(scope: SkillScope): string[] {
  if (scope.agentType === null) {
    return [join(scope.scopeRoot, 'skills')];
  }
  return allProjectSkillRemoveDirs(scope.agentType).map((relative) =>
    join(scope.scopeRoot, ...relative.split('/')),
  );
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

async function directoryExists(path: string): Promise<boolean> {
  return stat(path)
    .then((stats) => stats.isDirectory())
    .catch(() => false);
}

/**
 * Reads a folder's `repository.json` when it has one, and otherwise scans the folder for skills.
 * Most people keep their skills as plain `<name>/SKILL.md` folders (or loose `.md` files) without
 * ever writing a manifest, so a missing `repository.json` is a normal case, not an error.
 */
async function loadDirectoryIndex(dir: string): Promise<SkillRepositoryIndex> {
  if (!(await directoryExists(dir))) {
    throw new Error(`Folder not found: ${dir}`);
  }
  try {
    const raw = await readFile(join(dir, 'repository.json'), 'utf-8');
    return parseRepositoryIndex(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return scanSkillFolder(dir);
}

/** Resolves a repository's index and the base directory/URL its skill file paths are relative to. */
async function loadRepositoryIndex(
  repo: SkillRepository,
  options: { pull?: boolean } = {},
): Promise<{ index: SkillRepositoryIndex; baseDir: string | null; baseUrl: string | null }> {
  if (repo.sourceType === 'local-folder') {
    return { index: await loadDirectoryIndex(repo.source), baseDir: repo.source, baseUrl: null };
  }

  if (repo.sourceType === 'git') {
    const cacheDir = repoCacheDir(repo.id);
    const alreadyCloned = await directoryExists(join(cacheDir, '.git'));
    if (!alreadyCloned) {
      await rm(cacheDir, { recursive: true, force: true });
      await mkdir(dirname(cacheDir), { recursive: true });
      await execFileAsync('git', ['clone', '--depth=1', repo.source, cacheDir]);
    } else if (options.pull) {
      // Only pull on explicit refresh. Browsing the marketplace must not hit the network
      // for every repository on every open.
      await execFileAsync('git', ['-C', cacheDir, 'pull', '--ff-only']).catch(() => undefined);
    }
    return { index: await loadDirectoryIndex(cacheDir), baseDir: cacheDir, baseUrl: null };
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

const localRepoWatchers = new Map<string, FSWatcher>();
const localRepoRefreshTimers = new Map<string, NodeJS.Timeout>();

function broadcastRepositoryChanged(repositoryId: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) {
      win.webContents.send(IPC.skills.onRepositoryChanged, repositoryId);
    }
  }
}

/**
 * Watches every local-folder repository, so a skill dropped into (or removed from) the folder
 * shows up in the marketplace without the user hitting refresh.
 */
async function syncLocalRepositoryWatchers(): Promise<void> {
  const repos = await store.getRepositories();
  const localRepos = repos.filter((r) => r.sourceType === 'local-folder');

  for (const [repositoryId, watcher] of localRepoWatchers) {
    if (localRepos.some((r) => r.id === repositoryId)) continue;
    watcher.close();
    localRepoWatchers.delete(repositoryId);
    clearTimeout(localRepoRefreshTimers.get(repositoryId));
    localRepoRefreshTimers.delete(repositoryId);
  }

  for (const repo of localRepos) {
    if (localRepoWatchers.has(repo.id)) continue;
    try {
      const watcher = watch(repo.source, { recursive: true }, () => {
        // Editors and installers write in bursts, so collapse them into one refresh per repo.
        // A longer debounce keeps large trees (or tools that touch many files) from thrashing
        // the marketplace with rescans.
        clearTimeout(localRepoRefreshTimers.get(repo.id));
        localRepoRefreshTimers.set(
          repo.id,
          setTimeout(() => broadcastRepositoryChanged(repo.id), 1500),
        );
      });
      watcher.on('error', () => {
        watcher.close();
        localRepoWatchers.delete(repo.id);
      });
      localRepoWatchers.set(repo.id, watcher);
    } catch {
      // The folder can be gone or on a disconnected drive. Manual refresh still covers it.
    }
  }
}

export function registerSkillHandlers(): void {
  void syncLocalRepositoryWatchers();

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
      const source = input.source.trim();
      const repo: SkillRepository = {
        id: randomUUID(),
        name:
          input.name.trim() || (input.sourceType === 'local-folder' ? basename(source) : source),
        sourceType: input.sourceType,
        source,
        addedAt: new Date().toISOString(),
        lastRefreshedAt: null,
      };
      const { index } = await loadRepositoryIndex(repo);
      if (index.skills.length === 0) {
        throw new Error(
          input.sourceType === 'local-folder'
            ? `No skills found in "${source}". A skill is a folder with a SKILL.md inside it, or a .md file in this folder.`
            : `No skills found in "${source}".`,
        );
      }
      const repos = await store.getRepositories();
      repos.unshift({ ...repo, lastRefreshedAt: new Date().toISOString() });
      await store.setRepositories(repos);
      void syncLocalRepositoryWatchers();
      return repo;
    },
  );

  ipcMain.handle(
    IPC.skills.removeRepository,
    async (_event, repositoryId: string): Promise<void> => {
      const repos = await store.getRepositories();
      await store.setRepositories(repos.filter((r) => r.id !== repositoryId));
      await rm(repoCacheDir(repositoryId), { recursive: true, force: true });
      void syncLocalRepositoryWatchers();
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
      const { index } = await loadRepositoryIndex(repo, { pull: true });
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

  // Opens on whatever the renderer already has in the path field, falling back to the projects
  // folder from Settings, so the picker starts where the user keeps their work.
  ipcMain.handle(
    IPC.skills.pickLocalRepository,
    async (_event, currentPath?: string | null): Promise<string | null> => {
      const candidate = currentPath?.trim();
      const settings = await store.getSettings();
      const defaultPath =
        candidate && (await directoryExists(candidate))
          ? candidate
          : (settings.projectsRootPath ?? undefined);
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: defaultPath ?? undefined,
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    },
  );

  // Lets the Add Repository dialog say what it found in a typed or pasted path before adding it.
  ipcMain.handle(
    IPC.skills.previewLocalRepository,
    async (_event, folderPath: string): Promise<LocalSkillFolderPreview> => {
      const path = folderPath.trim();
      const preview: LocalSkillFolderPreview = {
        path,
        suggestedName: basename(path) || path,
        skillNames: [],
        hasManifest: false,
        error: null,
      };
      if (!path) return { ...preview, error: 'Enter a folder path.' };
      if (!(await directoryExists(path))) {
        return { ...preview, error: 'That folder does not exist.' };
      }
      preview.hasManifest = await readFile(join(path, 'repository.json'), 'utf-8')
        .then(() => true)
        .catch(() => false);
      try {
        const index = await loadDirectoryIndex(path);
        preview.skillNames = index.skills.map((s) => s.name);
        if (index.skills.length === 0) {
          preview.error =
            'No skills in this folder. A skill is a folder with a SKILL.md inside it, or a .md file here.';
        }
      } catch (error) {
        preview.error = error instanceof Error ? error.message : String(error);
      }
      return preview;
    },
  );

  ipcMain.handle(
    IPC.skills.install,
    async (
      _event,
      params: { projectId: string | null; repositoryId: string; skillId: string },
    ): Promise<void> => {
      const [scope, repos] = await Promise.all([
        resolveSkillScope(params.projectId),
        store.getRepositories(),
      ]);
      const repo = repos.find((r) => r.id === params.repositoryId);
      if (!repo) throw new Error(`Repository ${params.repositoryId} not found`);

      const { index, baseDir, baseUrl } = await loadRepositoryIndex(repo);
      const skill = index.skills.find((s) => s.id === params.skillId);
      if (!skill) throw new Error(`Skill ${params.skillId} not found in repository ${repo.name}`);

      const installDirs = await resolveSkillInstallDirs(scope);
      for (const skillsParent of installDirs) {
        const skillDir = join(skillsParent, skill.id);
        for (const file of skill.files) {
          const content = await readSkillFileContent(file, { baseDir, baseUrl });
          const targetPath = join(skillDir, file.path);
          await mkdir(dirname(targetPath), { recursive: true });
          await writeFile(targetPath, content, 'utf-8');
        }
      }

      const installed = await readInstalledSkills(scope.scopeRoot);
      const withoutExisting = installed.filter((s) => s.skillId !== skill.id);
      withoutExisting.push({
        skillId: skill.id,
        repositoryId: repo.id,
        version: skill.version,
        installedAt: new Date().toISOString(),
      });
      await writeInstalledSkills(scope.scopeRoot, withoutExisting);
    },
  );

  ipcMain.handle(
    IPC.skills.remove,
    async (_event, params: { projectId: string | null; skillId: string }): Promise<void> => {
      const scope = await resolveSkillScope(params.projectId);
      const installed = await readInstalledSkills(scope.scopeRoot);
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
          await runSkillsCli(args, scope.scopeRoot);
        }
      } else {
        // Cover agent dirs (.claude/skills, .agents/skills, …) plus the old root skills/ path.
        await Promise.all(
          resolveSkillRemoveDirs(scope).map((skillsParent) =>
            rm(join(skillsParent, params.skillId), { recursive: true, force: true }),
          ),
        );
      }

      await writeInstalledSkills(
        scope.scopeRoot,
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

  ipcMain.handle(IPC.skills.checkUiProPrerequisites, async (): Promise<UiProPrerequisites> => {
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
  });

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
