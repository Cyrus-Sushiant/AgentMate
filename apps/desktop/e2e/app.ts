import { execSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { type ElectronApplication, _electron as electron, type Page } from '@playwright/test';
import { E2E_OUT_DIR } from './paths';

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  root: string;
  userDataDir: string;
  projectDir: string;
  /** Reads settings.json as the app last wrote it. */
  settingsOnDisk(): Record<string, unknown>;
  /** Every argument line the fake `claude` was started with, version probes left out. */
  claudeLaunches(): string[];
  close(): Promise<void>;
}

/** What the fake `claude` answers a headless (`-p`) run with. */
export const FAKE_CLAUDE_ANSWER = 'feat: e2e change';

/**
 * A `claude` that records how it was started. Found first on PATH, so the app's own CLI
 * detection sees Claude Code as installed and a workspace tab starts this instead of the real one.
 * A headless run (`-p`, prompt on stdin) gets its prompt read to the end and a short answer, the
 * way the real CLI behaves, so background tasks finish normally.
 */
function writeFakeClaude(binDir: string, logFile: string): void {
  mkdirSync(binDir, { recursive: true });
  if (process.platform === 'win32') {
    writeFileSync(
      join(binDir, 'claude.cmd'),
      [
        '@echo off',
        'if "%~1"=="--version" goto version',
        `>>"${logFile}" echo(%*`,
        'if not "%~1"=="-p" exit /b 0',
        'more >nul',
        `echo ${FAKE_CLAUDE_ANSWER}`,
        'exit /b 0',
        ':version',
        'echo 9.9.9 (Claude Code)',
        '',
      ].join('\r\n'),
    );
  } else {
    const script = join(binDir, 'claude');
    writeFileSync(
      script,
      [
        '#!/bin/sh',
        'if [ "$1" = "--version" ]; then echo "9.9.9 (Claude Code)"; exit 0; fi',
        `echo "$*" >> '${logFile}'`,
        `if [ "$1" = "-p" ]; then cat >/dev/null; echo "${FAKE_CLAUDE_ANSWER}"; fi`,
        '',
      ].join('\n'),
    );
    chmodSync(script, 0o755);
  }
}

export async function launchApp(seed: {
  settings?: Record<string, unknown>;
}): Promise<LaunchedApp> {
  const root = mkdtempSync(join(tmpdir(), 'agentmate-e2e-'));
  const userDataDir = join(root, 'user-data');
  const projectDir = join(root, 'project');
  const binDir = join(root, 'bin');
  const logFile = join(root, 'claude-launches.log');
  mkdirSync(join(userDataDir, 'data'), { recursive: true });
  mkdirSync(projectDir, { recursive: true });
  writeFakeClaude(binDir, logFile);

  writeFileSync(
    join(userDataDir, 'data', 'settings.json'),
    JSON.stringify({
      // Shells end with the app, so no terminal host is left running after a test.
      keepTerminalsRunning: false,
      ...seed.settings,
    }),
  );

  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  const app = await electron.launch({
    args: [join(E2E_OUT_DIR, 'main', 'index.mjs'), `--user-data-dir=${userDataDir}`],
    env: {
      ...(process.env as Record<string, string>),
      [pathKey]: `${binDir}${delimiter}${process.env[pathKey] ?? ''}`,
      ELECTRON_RENDERER_URL: '',
    },
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => Boolean((window as { agentmat?: unknown }).agentmat));

  return {
    app,
    page,
    root,
    userDataDir,
    projectDir,
    settingsOnDisk: () =>
      JSON.parse(readFileSync(join(userDataDir, 'data', 'settings.json'), 'utf-8')),
    claudeLaunches: () =>
      existsSync(logFile)
        ? readFileSync(logFile, 'utf-8')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        : [],
    close: async () => {
      // A normal close asks "quit while agents are running?" once a CLI tab is open, so exit
      // outright and then stop the terminal host and shells it leaves behind.
      const exited = new Promise<void>((resolve) => app.process().once('exit', () => resolve()));
      await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => undefined);
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 10_000))]);
      killLeftovers(root);
      try {
        rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
      } catch {
        // A shell that was slow to die can still hold the folder; it lives in the temp dir.
      }
    },
  };
}

/** A terminal host or shell that outlived the app would keep the temp folder locked. */
function killLeftovers(root: string): void {
  if (process.platform !== 'win32') return;
  const needle = root.replace(/'/g, "''");
  try {
    execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${needle}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'ignore' },
    );
  } catch {
    // Nothing left to stop.
  }
}

/** Creates a project for the temp folder and opens its workspace. Returns the project id. */
export async function openWorkspace(launched: LaunchedApp): Promise<string> {
  const id = await createProject(launched);
  // A project made through IPC is not in the cached list yet, so reload onto its workspace.
  await launched.page.evaluate((projectId) => {
    location.hash = `#/workspace/${projectId}`;
  }, id);
  await launched.page.reload();
  return id;
}

/** Creates a project for the temp folder without navigating anywhere. Returns the project id. */
export async function createProject(launched: LaunchedApp): Promise<string> {
  const { page, projectDir } = launched;
  return page.evaluate(async (folderPath) => {
    const api = (
      window as unknown as {
        agentmat: { projects: { create(input: unknown): Promise<{ id: string }> } };
      }
    ).agentmat;
    const project = await api.projects.create({
      name: 'e2e project',
      folderPath,
      description: '',
      tags: [],
      agentType: 'claude-code',
      notes: '',
      runCommands: [],
    });
    return project.id;
  }, projectDir);
}

/** Makes the project folder a git repo with one commit and one uncommitted change. */
export function initGitRepo(launched: LaunchedApp): void {
  const git = (args: string): void => {
    execSync(`git -c user.name=e2e -c user.email=e2e@example.com ${args}`, {
      cwd: launched.projectDir,
      stdio: 'ignore',
    });
  };
  git('init -q');
  writeFileSync(join(launched.projectDir, 'package.json'), '{ "version": "1.0.0" }\n');
  git('add -A');
  git('commit -q -m "chore: initial"');
  writeFileSync(join(launched.projectDir, 'feature.txt'), 'a change to describe\n');
}
