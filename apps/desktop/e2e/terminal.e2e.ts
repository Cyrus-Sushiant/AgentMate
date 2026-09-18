import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { type LaunchedApp, launchApp } from './app';

/**
 * The terminal drawer against the real pty host: a shell is started, a command typed into it
 * comes back out, a second tab is its own shell, closing tabs ends those shells, and a quit with
 * nothing left open takes the background host with it.
 *
 * Output is read from `window.agentmat.terminal.onData` rather than from the xterm DOM: xterm
 * renders to a canvas-backed grid where a line can be wrapped, redrawn or scrolled out from under
 * a poll, while the data stream is exactly what main sent the renderer.
 */

/** A shell writes the command back as it is typed, so the marker is assembled by the shell. */
function marker(): { command: string; expected: string } {
  const id = randomBytes(6).toString('hex');
  return { command: `echo agentmate-"e2e"-${id}`, expected: `agentmate-e2e-${id}` };
}

interface TerminalApi {
  agentmat: {
    terminal: {
      write(sessionId: string, data: string): Promise<void>;
      usage(): Promise<{ sessions: { sessionId: string; pid: number; surface?: string }[] }>;
      onData(callback: (payload: { sessionId: string; data: string }) => void): () => void;
    };
  };
  __e2eTerminalOutput?: Record<string, string>;
}

let launched: LaunchedApp | undefined;

test.afterEach(async () => {
  const current = launched;
  launched = undefined;
  if (!current) return;
  try {
    await current.close();
  } catch {
    // The quit test lets the app exit on its own, after which Playwright has already let go of
    // it and close() cannot reach it. Its temp folder still has to go.
    rmSync(current.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  }
});

/** Collects everything every shell sends, keyed by session, for the rest of the page's life. */
async function captureOutput(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as unknown as TerminalApi;
    if (target.__e2eTerminalOutput) return;
    target.__e2eTerminalOutput = {};
    target.agentmat.terminal.onData(({ sessionId, data }) => {
      const store = target.__e2eTerminalOutput!;
      store[sessionId] = (store[sessionId] ?? '') + data;
    });
  });
}

function outputFor(page: Page, sessionId: string): Promise<string> {
  return page.evaluate(
    (id) => (window as unknown as TerminalApi).__e2eTerminalOutput?.[id] ?? '',
    sessionId,
  );
}

function drawerSessions(
  page: Page,
): Promise<{ sessionId: string; pid: number; surface?: string }[]> {
  return page.evaluate(async () => {
    const usage = await (window as unknown as TerminalApi).agentmat.terminal.usage();
    return usage.sessions.filter((session) => session.surface !== 'workspace');
  });
}

/**
 * Presses the toggle until the drawer is up. The shell binds the shortcut in an effect, so a
 * press fired in the first moments after launch can land before the listener exists.
 */
async function openDrawer(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  const emptyState = page.getByText('Open a terminal');
  await expect(async () => {
    await page.keyboard.press('Control+T');
    await expect(emptyState).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

/** True while a process with this pid is still around. */
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Processes whose command line mentions this run's temp folder: the app, the terminal host and
 * the shells under it. The lookup itself carries that folder in its own command line, so it is
 * left out of its own answer.
 */
function processesUnder(root: string): number {
  if (process.platform === 'win32') {
    const needle = root.replace(/'/g, "''");
    const out = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${needle}*' } | ForEach-Object { $_.CommandLine -replace '\\s+', ' ' }`,
      ],
      { encoding: 'utf-8' },
    );
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.includes('Win32_Process')).length;
  }
  try {
    // execFileSync, so no shell of our own shows up carrying the pattern.
    const out = execFileSync('pgrep', ['-f', root], { encoding: 'utf-8' });
    return out.split('\n').filter(Boolean).length;
  } catch {
    // pgrep exits non-zero when nothing matched.
    return 0;
  }
}

test('a shell runs a command, a second tab is its own, and closing tabs ends both', async () => {
  launched = await launchApp({ settings: {} });
  const current = launched;
  const { page } = current;
  await captureOutput(page);
  await openDrawer(page);

  // The drawer opens empty; a tab is a separate act.
  expect(await drawerSessions(page)).toEqual([]);
  await page.getByRole('button', { name: /^New (PowerShell|bash|zsh)$/ }).click();

  await expect.poll(() => drawerSessions(page), { timeout: 60_000 }).toHaveLength(1);
  const [first] = await drawerSessions(page);
  expect(first.pid).toBeGreaterThan(0);

  const { command, expected } = marker();
  await page.evaluate(
    ({ id, text }) => (window as unknown as TerminalApi).agentmat.terminal.write(id, `${text}\r`),
    { id: first.sessionId, text: command },
  );
  // The shell has to start, read the line and answer, which is slow on a cold Windows profile.
  await expect
    .poll(() => outputFor(page, first.sessionId), { timeout: 90_000 })
    .toContain(expected);

  // A second tab gets its own shell, not a second view of the first.
  await page
    .getByRole('button', { name: /^New (PowerShell|bash|zsh)/ })
    .first()
    .click();
  await expect.poll(() => drawerSessions(page), { timeout: 60_000 }).toHaveLength(2);
  const sessions = await drawerSessions(page);
  const pids = sessions.map((session) => session.pid);
  expect(new Set(pids).size).toBe(2);

  const tabs = page.getByRole('tablist', { name: 'Terminal sessions' });
  await expect(tabs.getByRole('tab')).toHaveCount(2);

  // Closing a tab ends its shell rather than only hiding the tab. Each click re-renders the
  // strip, so the next one is looked up again rather than held from before.
  const closeButtons = tabs.getByRole('button', { name: /^Close / });
  await expect(closeButtons).toHaveCount(2);
  await closeButtons.first().click();
  await expect(closeButtons).toHaveCount(1);
  await closeButtons.first().click();
  await expect(tabs.getByRole('tab')).toHaveCount(0);
  await expect(page.getByText('Open a terminal')).toBeVisible();
  await expect.poll(() => drawerSessions(page), { timeout: 60_000 }).toEqual([]);
  await expect.poll(() => pids.filter(pidAlive), { timeout: 60_000 }).toEqual([]);
});

test('quitting with no shells left takes the background host with it', async () => {
  launched = await launchApp({ settings: {} });
  const current = launched;
  const { page, root } = current;
  await openDrawer(page);

  await page.getByRole('button', { name: /^New (PowerShell|bash|zsh)$/ }).click();
  await expect.poll(() => drawerSessions(page), { timeout: 60_000 }).toHaveLength(1);
  // The host is a process of its own, started with this profile on its command line.
  expect(processesUnder(root)).toBeGreaterThan(0);

  await page
    .getByRole('button', { name: /^Close / })
    .first()
    .click();
  await expect.poll(() => drawerSessions(page), { timeout: 60_000 }).toEqual([]);

  // A normal quit, not the hard exit close() uses, so the host sees its client leave.
  const exited = new Promise<void>((resolve) =>
    current.app.process().once('exit', () => resolve()),
  );
  await current.app.evaluate(({ app }) => app.quit()).catch(() => undefined);
  await expect.poll(() => current.app.process().exitCode, { timeout: 60_000 }).not.toBe(null);
  await exited;

  // An idle host lingers briefly before exiting on its own (IDLE_EXIT_MS in hostEntry.ts).
  await expect.poll(() => processesUnder(root), { timeout: 90_000, intervals: [2_000] }).toBe(0);
});
