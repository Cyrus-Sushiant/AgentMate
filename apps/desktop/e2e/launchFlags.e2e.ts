import { expect, test } from '@playwright/test';
import { type LaunchedApp, launchApp, openWorkspace } from './app';

/**
 * A release install kept starting Claude Code with `--model haiku` that the Launch defaults
 * section said was "Not set". These drive the real app: what Settings shows, what "Remove it"
 * writes to disk, and the arguments a new workspace tab really starts `claude` with.
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

test('Launch defaults shows a model saved in the Arguments box and removes it', async () => {
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
  await expect(row).not.toContainText('Not set');
  await expect(row).toContainText('Haiku');
  await row.click();

  const panel = page.locator(`[id="${await row.getAttribute('aria-controls')}"]`);
  await expect(panel).toContainText('Still sent');
  await expect(panel).toContainText('--model haiku');
  await expect(panel.locator('code').last()).toHaveText(
    'claude --permission-mode auto --model haiku',
  );

  await panel.getByRole('button', { name: 'Remove it' }).click();
  await expect(panel).not.toContainText('Still sent');
  await expect(panel.locator('code').last()).toHaveText('claude --permission-mode auto');

  await expect.poll(() => launched?.settingsOnDisk().cliArgs).toEqual({});
  expect(launched.settingsOnDisk().cliLaunchDefaults).toEqual({ 'claude-code': { mode: 'auto' } });

  const args = await claudeTabArgs(launched);
  expect(args).toContain('--permission-mode auto');
  expect(args).not.toContain('--model');
});

test('a model the user saved in the Arguments box is still sent', async () => {
  launched = await launchApp({
    settings: { defaultCliId: 'claude-code', cliArgs: { 'claude-code': '--model sonnet' } },
  });
  const args = await claudeTabArgs(launched);
  expect(args).toContain('--model sonnet');
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
