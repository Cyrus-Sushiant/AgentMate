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

/**
 * A `claude` that only records how it was started. Found first on PATH, so the app's own CLI
 * detection sees Claude Code as installed and a workspace tab starts this instead of the real one.
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
  const { page, projectDir } = launched;
  const id = await page.evaluate(async (folderPath) => {
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
  // A project made through IPC is not in the cached list yet, so reload onto its workspace.
  await page.evaluate((projectId) => {
    location.hash = `#/workspace/${projectId}`;
  }, id);
  await page.reload();
  return id;
}
