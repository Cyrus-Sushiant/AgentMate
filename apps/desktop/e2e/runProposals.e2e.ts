import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { type LaunchedApp, launchApp } from './app';

/**
 * A run command suggested by an agent, through the real app. The test plays the agent's side: it
 * starts the bridge named in the project's .mcp.json, the way Claude Code does, and sends it the
 * same MCP messages. The suggestion must then wait in the app, and only "Add command" may save it.
 */

const NAME = 'Suggestion e2e';
const SUGGESTED = 'flutter run -d emulator-5554';

let launched: LaunchedApp | undefined;

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
});

async function createProject(current: LaunchedApp): Promise<string> {
  return current.page.evaluate(
    async ({ folderPath, name }) => {
      const api = (
        window as unknown as {
          agentmat: { projects: { create(input: unknown): Promise<{ id: string }> } };
        }
      ).agentmat;
      const project = await api.projects.create({
        name,
        folderPath,
        description: '',
        tags: [],
        agentType: 'claude-code',
        notes: '',
        runCommands: [],
      });
      return project.id;
    },
    { folderPath: current.projectDir, name: NAME },
  );
}

/** A project made over IPC is not in the cached list yet, so the page is reloaded onto it. */
async function openRoute(current: LaunchedApp, hash: string): Promise<void> {
  await current.page.evaluate((target) => {
    location.hash = target;
  }, hash);
  await current.page.reload();
}

/** Turns the feature on through the app's own switch, which writes the project's .mcp.json. */
async function switchOn(current: LaunchedApp, id: string): Promise<void> {
  const result = await current.page.evaluate(
    (projectId) =>
      (
        window as unknown as {
          agentmat: {
            runProposals: { setEnabled(projectId: string, enabled: boolean): Promise<unknown> };
          };
        }
      ).agentmat.runProposals.setEnabled(projectId, true),
    id,
  );
  expect(result).toEqual({ ok: true });
}

/** The bridge script the project's .mcp.json starts, exactly as Claude Code would find it. */
function bridgeScriptOf(current: LaunchedApp): string {
  const config = JSON.parse(readFileSync(join(current.projectDir, '.mcp.json'), 'utf-8')) as {
    mcpServers: { agentmate: { command: string; args: string[] } };
  };
  expect(config.mcpServers.agentmate.command).toBe('node');
  const script = config.mcpServers.agentmate.args[0];
  expect(existsSync(script)).toBe(true);
  return script;
}

/** Starts the bridge, sends the messages, and resolves once the reply to `lastId` has arrived. */
function talkToBridge(script: string, messages: unknown[], lastId: number) {
  return new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: ['pipe', 'pipe', 'inherit'] });
    let stdout = '';
    let finished = false;
    const replies = () =>
      stdout
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
      if (!finished && replies().some((reply) => reply.id === lastId)) {
        finished = true;
        child.kill();
        resolve(replies());
      }
    });
    child.on('error', reject);
    for (const message of messages) child.stdin.write(`${JSON.stringify(message)}\n`);
  });
}

function proposeMessages(command: string) {
  return [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {} },
    },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'propose_run_command',
        arguments: { label: 'android dev', command },
      },
    },
  ];
}

function runCommandsOnDisk(current: LaunchedApp, id: string): unknown[] {
  const file = join(current.userDataDir, 'data', 'projects.json');
  const projects = JSON.parse(readFileSync(file, 'utf-8')) as {
    id: string;
    runCommands: unknown[];
  }[];
  return projects.find((project) => project.id === id)?.runCommands ?? [];
}

test('a suggestion from the agent waits for approval, and Add command saves it', async () => {
  launched = await launchApp({ settings: {} });
  const current = launched;
  const { page } = current;
  const id = await createProject(current);
  await openRoute(current, `#/projects/${id}`);
  await expect(page.getByRole('heading', { name: NAME })).toBeVisible();
  await switchOn(current, id);

  const replies = await talkToBridge(bridgeScriptOf(current), proposeMessages(SUGGESTED), 2);

  expect(replies.find((reply) => reply.id === 2)).toMatchObject({
    result: {
      content: [{ type: 'text', text: expect.stringContaining('waits for the user to approve it') }],
      isError: false,
    },
  });
  const dialog = page.getByRole('dialog', { name: `Add "android dev" to ${NAME}?` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(SUGGESTED)).toBeVisible();
  // Nothing is saved while the suggestion waits.
  expect(runCommandsOnDisk(current, id)).toEqual([]);

  await dialog.getByRole('button', { name: 'Add command' }).click();

  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => runCommandsOnDisk(current, id))
    .toEqual([{ id: expect.any(String), label: 'android dev', command: SUGGESTED }]);
});

test('Discard drops the suggestion and leaves the project as it was', async () => {
  launched = await launchApp({ settings: {} });
  const current = launched;
  const { page } = current;
  const id = await createProject(current);
  await openRoute(current, `#/projects/${id}`);
  await expect(page.getByRole('heading', { name: NAME })).toBeVisible();
  await switchOn(current, id);

  await talkToBridge(bridgeScriptOf(current), proposeMessages('npm run serve'), 2);
  const dialog = page.getByRole('dialog', { name: `Add "android dev" to ${NAME}?` });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Discard' }).click();

  await expect(dialog).toHaveCount(0);
  await expect.poll(() => runCommandsOnDisk(current, id)).toEqual([]);
});
