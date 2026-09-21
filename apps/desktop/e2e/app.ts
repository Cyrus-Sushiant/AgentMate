import { type ChildProcess, execSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, join } from 'node:path';
import { type ElectronApplication, _electron as electron, type Page } from '@playwright/test';
import { E2E_OUT_DIR, MAIN_LOG_DIR } from './paths';

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
  /** Everything the app has printed on stdout/stderr so far. */
  mainLog(): string;
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

/** Streams the app's own output to a file named after this run's temp folder. */
function captureMainOutput(app: ElectronApplication, root: string): string | null {
  let child: ChildProcess;
  try {
    child = app.process();
  } catch {
    return null;
  }
  mkdirSync(MAIN_LOG_DIR, { recursive: true });
  const logFile = join(MAIN_LOG_DIR, `${basename(root)}.log`);
  const write = (chunk: Buffer): void => {
    try {
      appendFileSync(logFile, chunk);
    } catch {
      // The folder can be swept between tests; losing a log must never fail a run.
    }
  };
  child.stdout?.on('data', write);
  child.stderr?.on('data', write);
  return logFile;
}

export async function launchApp(seed: {
  settings?: Record<string, unknown>;
  /** Extra environment for the app, for tests that drive a fake tool through one. */
  env?: Record<string, string>;
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
    args: [
      join(E2E_OUT_DIR, 'main', 'index.mjs'),
      `--user-data-dir=${userDataDir}`,
      // Ubuntu runners block the unprivileged user namespaces Chromium's sandbox needs.
      ...(process.env.AGENTMATE_E2E_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
    ],
    env: {
      ...(process.env as Record<string, string>),
      [pathKey]: `${binDir}${delimiter}${process.env[pathKey] ?? ''}`,
      ELECTRON_RENDERER_URL: '',
      // src/main/testMode.ts reads these before anything touches userData: the profile moves,
      // the single-instance lock and terminal host pipe move with it, and the startup work that
      // reaches outside the profile (the docker scan sweep, update checks) stays off.
      AGENTMATE_USER_DATA_DIR: userDataDir,
      AGENTMATE_E2E: '1',
      ...seed.env,
    },
  });
  const mainLogFile = captureMainOutput(app, root);
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
    mainLog: () =>
      mainLogFile && existsSync(mainLogFile) ? readFileSync(mainLogFile, 'utf-8') : '',
    close: async () => {
      // Closed through Playwright's own API, or it keeps a handle on the app and the worker sits
      // at teardown until it times out. AGENTMATE_E2E lets the quit guard through, so this no
      // longer waits for the "quit while agents are running?" confirmation.
      //
      // The child process is taken before closing: afterwards Playwright has dropped its own
      // handle and app.process() throws. A test that restarts the app has already stopped this
      // one itself, so the handle can be gone before close() is ever reached.
      let child: ChildProcess | null;
      try {
        child = app.process();
      } catch {
        child = null;
      }
      const exited = child
        ? new Promise<void>((resolve) => child?.once('exit', () => resolve()))
        : Promise.resolve();
      await Promise.race([
        app.close().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 15_000)),
      ]);
      // Anything that ignored the close is killed outright, so nothing holds the temp folder open.
      if (child && child.exitCode === null && !child.killed) {
        child.kill();
        await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
      }
      killLeftovers(root);
      keepHostLog(userDataDir, root);
      try {
        rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
      } catch {
        // A shell that was slow to die can still hold the folder; it lives in the temp dir.
      }
    },
  };
}

/** The terminal host's own log, which otherwise goes with the profile it lives in. */
function keepHostLog(userDataDir: string, root: string): void {
  const source = join(userDataDir, 'pty-host', 'host.log');
  if (!existsSync(source)) return;
  try {
    mkdirSync(MAIN_LOG_DIR, { recursive: true });
    copyFileSync(source, join(MAIN_LOG_DIR, `${basename(root)}-pty-host.log`));
  } catch {
    // Best effort, same as the main log.
  }
}

/** A terminal host or shell that outlived the app would keep the temp folder locked. */
function killLeftovers(root: string): void {
  if (process.platform !== 'win32') {
    // The terminal host is detached, so it survives the app it was started by.
    try {
      execSync(`pkill -f ${JSON.stringify(root)}`, { stdio: 'ignore' });
    } catch {
      // pkill exits non-zero when nothing matched, which is the normal case.
    }
    return;
  }
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
