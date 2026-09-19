import { expect, type Locator, type Page, test } from '@playwright/test';
import { type LaunchedApp, launchApp } from './app';
import { type FakeOllama, startFakeOllama } from './fakeOllama';
import {
  dockerAvailable,
  SSH_PASSWORD,
  SSH_USER,
  type SshTestServer,
  startSshServer,
} from './sshServer';

/**
 * "Ask AI to run a task here" on a real SSH server (Docker), through the real app. The AI is a
 * fake Ollama following a script. Covers what users reported: marker text showing up in the
 * terminal, and sudo needing a typed password instead of the one saved for the server.
 */

test.skip(!dockerAvailable(), 'needs Docker to start the test SSH server');

let server: SshTestServer | undefined;
let ollama: FakeOllama | undefined;
let launched: LaunchedApp | undefined;

test.beforeAll(async () => {
  test.setTimeout(600_000);
  server = await startSshServer();
});

test.afterAll(() => {
  server?.stop();
});

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
  await ollama?.close();
  ollama = undefined;
});

const SHELL_PROMPT = `${SSH_USER}@e2e-server:~$`;

/** The active terminal tab's visible rows, as text. */
function terminalRows(page: Page): Locator {
  return page.locator('.terminal-pane .xterm-rows');
}

async function terminalText(page: Page): Promise<string> {
  return (await terminalRows(page).innerText()).replace(/ /g, ' ');
}

/** The AI status bar above the terminal. */
function agentBar(page: Page): Locator {
  return page.locator('.terminal-well').locator('xpath=preceding-sibling::div[1]');
}

async function openServerTab(replies: string[]): Promise<Page> {
  if (!server) throw new Error('SSH server did not start');
  ollama = await startFakeOllama(replies);
  launched = await launchApp({
    settings: {
      promptBuilderProvider: 'ollama',
      ollamaModel: 'e2e-script',
      ollamaBaseUrl: ollama.url,
    },
  });
  const { page } = launched;

  // Saved through the app itself, so the password is encrypted the way a real save does it.
  await page.evaluate(
    (input) =>
      (
        window as unknown as { agentmat: { ssh: { saveServer(i: unknown): Promise<unknown> } } }
      ).agentmat.ssh.saveServer(input),
    {
      nickname: 'E2E server',
      host: server.host,
      port: server.port,
      username: SSH_USER,
      authMethod: 'password',
      secret: SSH_PASSWORD,
    },
  );

  await page.evaluate(() => {
    location.hash = '#/remote';
  });
  await page.getByRole('button', { name: 'SSH', exact: true }).click();
  // The Remote page has a "Connect" tab of its own, so this has to be the server's own button.
  const savedServer = page.getByRole('listitem').filter({ hasText: 'E2E server' });
  await expect(savedServer).toBeVisible({ timeout: 30_000 });
  await savedServer.getByRole('button', { name: 'Connect' }).click();
  await expect(terminalRows(page)).toContainText(SHELL_PROMPT, { timeout: 30_000 });
  return page;
}

async function startTask(page: Page, prompt: string): Promise<void> {
  await page.getByRole('button', { name: 'Ask AI to run a task here' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(prompt);
  const cli = dialog.getByRole('combobox').first();
  await expect(cli).toBeEnabled({ timeout: 30_000 });
  if (!(await cli.innerText()).includes('AI provider (Settings)')) {
    await cli.click();
    await page.getByRole('option', { name: 'AI provider (Settings)' }).click();
  }
  await dialog.getByText('Fully autonomous').click();
  await dialog.getByRole('button', { name: 'Start' }).click();
  await expect(dialog).toBeHidden();
}

test('runs commands with clean output and answers sudo with the saved password', async () => {
  const page = await openServerTab([
    'RUN: grep CODENAME /etc/os-release',
    'RUN: sudo -n id -u',
    'RUN: echo tick1; sleep 3; echo tick2',
    'FINISHED: Checked the server.',
  ]);
  await startTask(page, 'Check the OS and that sudo works');

  // The AI asked for `sudo -n`; it runs as plain sudo so the password bar can answer it.
  const bar = agentBar(page);
  await expect(bar).toContainText('is asking for a password', { timeout: 60_000 });
  await bar.getByRole('button', { name: 'Enter password' }).click();

  // Output shows up while the command is still going.
  await expect(terminalRows(page)).toContainText('tick1', { timeout: 60_000 });
  expect(await terminalText(page)).not.toMatch(/^tick2$/m);
  await expect(bar).toContainText('Running');

  await expect(bar).toContainText('Checked the server.', { timeout: 60_000 });

  const text = await terminalText(page);
  expect(text).toContain(`${SHELL_PROMPT} grep CODENAME /etc/os-release`);
  expect(text).toContain('UBUNTU_CODENAME=jammy');
  expect(text).toContain(`${SHELL_PROMPT} sudo id -u`);
  expect(text).toMatch(/^0$/m);
  expect(text).toContain(`${SHELL_PROMPT} echo tick1; sleep 3; echo tick2`);
  expect(text).toMatch(/^tick1\ntick2$/m);
  expect(text).not.toContain('AGENTMATE');
  expect(text).not.toContain('AgentMate:');
  expect(text).not.toContain('printf');
  expect(text).not.toContain(SSH_PASSWORD);
  expect(text).not.toContain('a password is required');

  // The AI saw real results and never the password.
  const transcript = ollama?.prompts.at(-1) ?? '';
  expect(transcript).toContain('$ sudo id -u [exit code 0]');
  expect(transcript).toContain(
    '$ grep CODENAME /etc/os-release [exit code 0]\nUBUNTU_CODENAME=jammy',
  );
  expect(ollama?.prompts.join('\n')).not.toContain(SSH_PASSWORD);
});

test('lets the user type the sudo password themselves', async () => {
  const page = await openServerTab(['RUN: sudo id -un', 'FINISHED: Confirmed root.']);
  await startTask(page, 'Check sudo');

  const bar = agentBar(page);
  await expect(bar).toContainText('is asking for a password', { timeout: 60_000 });
  await bar.getByRole('button', { name: "I'll type it" }).click();

  await terminalRows(page).click();
  await page.keyboard.type(SSH_PASSWORD);
  await page.keyboard.press('Enter');

  await expect(bar).toContainText('Confirmed root.', { timeout: 60_000 });
  const text = await terminalText(page);
  expect(text).toMatch(/^root$/m);
  expect(text).not.toContain(SSH_PASSWORD);
  expect(ollama?.prompts.at(-1)).toContain('$ sudo id -un [exit code 0]');
});

test('shows a failing command with its error and passes the exit code on', async () => {
  const page = await openServerTab(['RUN: ls /does-not-exist', 'FINISHED: It is missing.']);
  await startTask(page, 'Look for /does-not-exist');

  await expect(agentBar(page)).toContainText('It is missing.', { timeout: 60_000 });
  const text = await terminalText(page);
  expect(text).toContain(`${SHELL_PROMPT} ls /does-not-exist`);
  expect(text).toContain("ls: cannot access '/does-not-exist': No such file or directory");
  expect(text).not.toContain('AgentMate:');
  expect(ollama?.prompts.at(-1)).toContain('$ ls /does-not-exist [exit code 2]');
});
