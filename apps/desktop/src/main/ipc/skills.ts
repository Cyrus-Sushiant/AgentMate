import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { app, dialog, ipcMain } from 'electron';
import {
  parseRepositoryIndex,
  SKILLS_SH_PSEUDO_REPOSITORY_ID,
  SKILLS_SH_VERIFIED_OWNERS,
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
  SkillsShDetail,
  SkillsShSearchResult,
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

const GITHUB_API_HEADERS = {
  'User-Agent': 'AgentMate',
  Accept: 'application/vnd.github+json',
};

/** Lists every file under `{skillName}/` in a skill's GitHub repo, via the repo's file tree. */
async function listSkillsShFiles(
  repo: string,
  skillName: string,
): Promise<{ branch: string; paths: string[] }> {
  const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: GITHUB_API_HEADERS,
  });
  if (!repoRes.ok) throw new Error(`GitHub repo lookup failed for ${repo}: HTTP ${repoRes.status}`);
  const { default_branch: branch } = (await repoRes.json()) as { default_branch: string };

  const treeRes = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
    { headers: GITHUB_API_HEADERS },
  );
  if (!treeRes.ok) throw new Error(`GitHub tree lookup failed for ${repo}: HTTP ${treeRes.status}`);
  const { tree } = (await treeRes.json()) as { tree: { path: string; type: string }[] };

  const prefix = `${skillName}/`;
  const paths = tree
    .filter((e) => e.type === 'blob' && e.path.startsWith(prefix))
    .map((e) => e.path);
  return { branch, paths };
}

export function registerSkillHandlers(): void {
  ipcMain.handle(IPC.skills.listRepositories, (): Promise<SkillRepository[]> =>
    store.getRepositories(),
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
      params: { projectId: string; repositoryId: string; skillId: string },
    ): Promise<void> => {
      const [projects, repos] = await Promise.all([store.getProjects(), store.getRepositories()]);
      const project = projects.find((p) => p.id === params.projectId);
      if (!project) throw new Error(`Project ${params.projectId} not found`);
      const repo = repos.find((r) => r.id === params.repositoryId);
      if (!repo) throw new Error(`Repository ${params.repositoryId} not found`);

      const { index, baseDir, baseUrl } = await loadRepositoryIndex(repo);
      const skill = index.skills.find((s) => s.id === params.skillId);
      if (!skill) throw new Error(`Skill ${params.skillId} not found in repository ${repo.name}`);

      const skillDir = join(project.folderPath, 'skills', skill.id);
      for (const file of skill.files) {
        const content = await readSkillFileContent(file, { baseDir, baseUrl });
        const targetPath = join(skillDir, file.path);
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, content, 'utf-8');
      }

      const installed = await readInstalledSkills(project.folderPath);
      const withoutExisting = installed.filter((s) => s.skillId !== skill.id);
      withoutExisting.push({
        skillId: skill.id,
        repositoryId: repo.id,
        version: skill.version,
        installedAt: new Date().toISOString(),
      });
      await writeInstalledSkills(project.folderPath, withoutExisting);
    },
  );

  ipcMain.handle(
    IPC.skills.remove,
    async (_event, params: { projectId: string; skillId: string }): Promise<void> => {
      const projects = await store.getProjects();
      const project = projects.find((p) => p.id === params.projectId);
      if (!project) throw new Error(`Project ${params.projectId} not found`);

      await rm(join(project.folderPath, 'skills', params.skillId), {
        recursive: true,
        force: true,
      });

      const installed = await readInstalledSkills(project.folderPath);
      await writeInstalledSkills(
        project.folderPath,
        installed.filter((s) => s.skillId !== params.skillId),
      );
    },
  );

  ipcMain.handle(
    IPC.skills.listInstalled,
    async (_event, projectId: string): Promise<InstalledSkillRecord[]> => {
      const projects = await store.getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error(`Project ${projectId} not found`);
      return readInstalledSkills(project.folderPath);
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

  ipcMain.handle(
    IPC.skills.installFromSkillsSh,
    async (_event, params: InstallFromSkillsShInput): Promise<void> => {
      const projects = await store.getProjects();
      const project = projects.find((p) => p.id === params.projectId);
      if (!project) throw new Error(`Project ${params.projectId} not found`);

      const { branch, paths } = await listSkillsShFiles(params.repo, params.skillName);
      if (paths.length === 0) {
        throw new Error(
          `No files found for ${params.repo}/${params.skillName} on GitHub — the skill may have moved or been renamed.`,
        );
      }

      const skillId = `${params.repo}/${params.skillName}`;
      const skillDir = join(project.folderPath, 'skills', skillId);
      const prefix = `${params.skillName}/`;
      for (const path of paths) {
        const rawUrl = `https://raw.githubusercontent.com/${params.repo}/${branch}/${path}`;
        const fileRes = await fetch(rawUrl);
        if (!fileRes.ok) throw new Error(`Failed to fetch ${path}: HTTP ${fileRes.status}`);
        const content = Buffer.from(await fileRes.arrayBuffer());
        const targetPath = join(skillDir, path.slice(prefix.length));
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, content);
      }

      const installed = await readInstalledSkills(project.folderPath);
      const withoutExisting = installed.filter((s) => s.skillId !== skillId);
      withoutExisting.push({
        skillId,
        repositoryId: SKILLS_SH_PSEUDO_REPOSITORY_ID,
        version: branch,
        installedAt: new Date().toISOString(),
      });
      await writeInstalledSkills(project.folderPath, withoutExisting);
    },
  );
}
