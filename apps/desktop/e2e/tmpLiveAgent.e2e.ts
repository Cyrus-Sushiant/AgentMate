import { spawn } from 'node:child_process';

import { createWriteStream, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { type LaunchedApp, launchApp } from './app';

// Temporary: a real Claude Code session proposes a run command into the app. Deleted after use.
const SHOTS = 'C:/Users/arc13/AppData/Local/Temp/claude/E--AgentMate/acd6ef39-ccad-479c-b1a8-5a3b2c11eec0/scratchpad/shots';
const NAME = 'Live agent e2e';

test.setTimeout(420_000);

test('a real Claude Code session proposes a run command, and the app asks before saving it', async () => {
  const launched: LaunchedApp = await launchApp({ settings: { theme: 'light' } });
  try {
    const { page } = launched;
    await page.setViewportSize({ width: 1100, height: 800 });
    const id = await page.evaluate(
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
      { folderPath: launched.projectDir, name: NAME },
    );
    await page.evaluate((hash) => {
      location.hash = hash;
    }, `#/projects/${id}?tab=mcp`);
    await page.reload();
    await expect(page.getByRole('heading', { name: NAME })).toBeVisible();

    const toggle = page.getByRole('switch', { name: 'Let agents suggest run commands' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ path: `${SHOTS}/live-switch-on.png`, animations: 'disabled' });

    const config = JSON.parse(readFileSync(join(launched.projectDir, '.mcp.json'), 'utf-8')) as {
      mcpServers: { agentmate: { args: string[] } };
    };
    const script = config.mcpServers.agentmate.args[0];
    const mcpConfig = join(launched.projectDir, 'live-check.json');
    writeFileSync(
      mcpConfig,
      JSON.stringify({ mcpServers: { agentmate: { command: 'node', args: [script] } } }),
    );

    const prompt =
      "Use the propose_run_command tool once to suggest a run command labelled 'android dev' with the command 'flutter run -d emulator-5554'. Then reply with the text the tool returned, and nothing else.";
    const claude = spawn(
      'claude',
      [
        '-p',
        '--mcp-config',
        mcpConfig,
        '--strict-mcp-config',
        '--allowedTools',
        'mcp__agentmate__propose_run_command',
        '--max-turns',
        '4',
      ],
      { cwd: launched.projectDir, shell: true },
    );
    let output = '';
    const log = createWriteStream(join(SHOTS, '..', 'live-claude.txt'));
    claude.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf-8');
      log.write(chunk);
    });
    claude.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf-8');
      log.write(chunk);
    });
    claude.on('exit', (code) => log.write(`\nEXIT ${String(code)}\n`));
    claude.on('error', (error) => log.write(`\nSPAWN ERROR ${error.message}\n`));
    claude.stdin.end(prompt);

    const dialog = page.getByRole('dialog', { name: new RegExp(`^Add .* to ${NAME}\\?$`) });
    try {
      await expect(dialog).toBeVisible({ timeout: 180_000 });
    } catch (error) {
      writeFileSync(join(SHOTS, '..', 'live-debug.txt'), JSON.stringify({ mcpConfig: readFileSync(mcpConfig, 'utf-8'), script, claudeOutput: output, mainLog: launched.mainLog().slice(-4000) }, null, 2));
      await page.screenshot({ path: join(SHOTS, 'live-failed.png'), animations: 'disabled' });
      throw error;
    }
    await expect(dialog.getByText(/flutter run -d emulator-5554/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/live-approval.png`, animations: 'disabled' });

    const file = join(launched.userDataDir, 'data', 'projects.json');
    const before = JSON.parse(readFileSync(file, 'utf-8')) as { id: string; runCommands: unknown[] }[];
    expect(before.find((project) => project.id === id)?.runCommands).toEqual([]);

    await dialog.getByRole('button', { name: 'Add command' }).click();
    await expect(dialog).toHaveCount(0);

    await expect
      .poll(() => {
        const projects = JSON.parse(readFileSync(file, 'utf-8')) as {
          id: string;
          runCommands: { command: string }[];
        }[];
        return projects.find((project) => project.id === id)?.runCommands.map((c) => c.command);
      })
      .toEqual(['flutter run -d emulator-5554']);

    // The agent's own summary of what happened, for the record.
    claude.kill();
    console.log('CLAUDE_OUTPUT_START\n' + output.slice(0, 2000) + '\nCLAUDE_OUTPUT_END');
  } finally {
    await launched.close();
  }
});
