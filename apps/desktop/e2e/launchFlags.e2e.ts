import { expect, test } from '@playwright/test';
import { type LaunchedApp, launchApp, openWorkspace } from './app';

/**
 * A release install kept starting Claude Code with `--model haiku` saved in the AI CLI Manager
 * Arguments box, which is meant for background tasks only. These drive the real app and check
 * the arguments a new workspace tab really starts `claude` with.
 */

let launched: LaunchedApp | undefined;

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
});

async function claudeTabArgs(current: LaunchedApp): Promise<string> {
  await openWorkspace(current);
  const { page } = current;
  const tile = page.getByRole('button', { name: /Claude Code/ }).first();
  await expect(tile).toBeVisible({ timeout: 60_000 });
  // Right after the reload the workspace is still restoring its saved layout, which can drop a
  // tab opened that early. Click until a terminal is really there.
  await expect(async () => {
    if ((await page.locator('.xterm').count()) === 0) await tile.click();
    await expect(page.locator('.xterm').first()).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect.poll(() => current.claudeLaunches().length, { timeout: 60_000 }).toBeGreaterThan(0);
  return current.claudeLaunches().at(-1) ?? '';
}

test('a new Claude Code tab gets no model when none is set anywhere', async () => {
  launched = await launchApp({
    settings: { defaultCliId: 'claude-code', cliArgs: {}, cliLaunchDefaults: {} },
  });
  const args = await claudeTabArgs(launched);
  expect(args).not.toMatch(/--model|(^|\s)-m\s/);
  expect(args).not.toContain('--effort');
  expect(args).not.toContain('--permission-mode');
});

test('a model saved in the Arguments box never reaches a workspace tab', async () => {
  launched = await launchApp({
    settings: {
      defaultCliId: 'claude-code',
      cliArgs: { 'claude-code': '--model haiku' },
      cliLaunchDefaults: { 'claude-code': { mode: 'auto' } },
    },
  });
  const { page } = launched;
  await page.evaluate(() => {
    location.hash = '#/settings?tab=agents';
  });

  const row = page.locator('button[aria-controls]').filter({ hasText: 'Claude Code' }).first();
  await expect(row).toBeVisible();
  await expect(row).not.toContainText('Haiku');
  await row.click();
  const panel = page.locator(`[id="${await row.getAttribute('aria-controls')}"]`);
  await expect(panel.locator('code').last()).toHaveText('claude --permission-mode auto');

  const args = await claudeTabArgs(launched);
  expect(args).toContain('--permission-mode auto');
  expect(args).not.toContain('--model');
  // Still saved: background tasks keep using it.
  expect(launched.settingsOnDisk().cliArgs).toEqual({ 'claude-code': '--model haiku' });
});

test('a launch default model reaches the CLI', async () => {
  launched = await launchApp({
    settings: {
      defaultCliId: 'claude-code',
      cliLaunchDefaults: { 'claude-code': { model: 'opus', effort: 'high' } },
    },
  });
  const args = await claudeTabArgs(launched);
  expect(args).toContain('--model opus --effort high');
});
