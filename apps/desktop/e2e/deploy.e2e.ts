import { expect, test } from '@playwright/test';
import { type LaunchedApp, launchApp } from './app';
import { type DevHost, dotnetAvailable, startDevHost } from './devHost';

/**
 * The Deploy page against a real server core: the DevHost on loopback, reached through the same
 * REST client and health card the app uses for a server over SSH. Runs on every OS the suite
 * does, since it needs the .NET SDK but no Linux server.
 */

test.skip(!dotnetAvailable(), 'needs the .NET SDK to build the server core DevHost');

let devHost: DevHost | undefined;
let launched: LaunchedApp | undefined;

test.beforeAll(async () => {
  test.setTimeout(300_000);
  devHost = await startDevHost();
});

test.afterAll(() => {
  devHost?.stop();
});

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
});

test('shows the DevHost core as online with its version and uptime', async () => {
  if (!devHost) throw new Error('DevHost did not start');
  launched = await launchApp({
    settings: {},
    env: { AGENTMATE_DEPLOY_DEV_CORE: String(devHost.port) },
  });
  const { page } = launched;

  await page.getByRole('link', { name: 'Deploy' }).click();

  const rail = page.getByRole('navigation', { name: 'Servers' });
  await expect(rail.getByText('DevHost')).toBeVisible();
  await expect(rail.getByText(/^Online, core /)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Development')).toBeVisible();
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
  await expect(page.getByText('Loopback (DevHost)').first()).toBeVisible();
  await expect(page.getByText(/less than a minute|\d+ min/)).toBeVisible();
});

test('lists no DevHost when the app is not pointed at one', async () => {
  launched = await launchApp({ settings: {} });
  const { page } = launched;

  await page.getByRole('link', { name: 'Deploy' }).click();

  await expect(page.getByText('No servers yet')).toBeVisible();
});
