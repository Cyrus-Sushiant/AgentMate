import { expect, test } from '@playwright/test';
import { type LaunchedApp, launchApp } from './app';

/**
 * The Cloudflare page in the built app: it opens from the Deploy section and starts with its
 * token guide, served by the real main process. The test profile has no token, so nothing ever
 * reaches Cloudflare: the guide's link would open a browser and is left alone, and text that
 * cannot be a token is refused in the app before anything is sent.
 */

let launched: LaunchedApp | undefined;

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
});

test('opens from Deploy and walks through the token setup', async () => {
  launched = await launchApp({ settings: {} });
  const { page } = launched;

  await page.getByRole('link', { name: 'Deploy' }).click();
  await page.getByRole('button', { name: 'Manage Cloudflare' }).click();

  await expect(page.getByText('Connect Cloudflare')).toBeVisible();
  for (const permission of [
    'Zone > Zone > Read',
    'Zone > DNS > Edit',
    'Zone > Zone Settings > Edit',
    'Zone > Cache Purge > Purge',
    'Zone > Zone WAF > Edit',
    'Zone > Firewall Services > Edit',
  ]) {
    await expect(page.getByText(permission, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: "Open Cloudflare's token page" })).toBeVisible();

  // A Global API Key can do anything on the account, so the app refuses it outright.
  await page.getByLabel('API token').fill('0123456789abcdef0123456789abcdef01234');
  await page.getByRole('button', { name: 'Save and check' }).click();
  await expect(page.getByRole('alert')).toContainText('Global API Key');

  await page.getByRole('link', { name: /Back to Deploy/ }).click();
  await expect(page.getByText('No servers yet')).toBeVisible();
});
