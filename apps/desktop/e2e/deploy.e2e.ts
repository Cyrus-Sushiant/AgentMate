import { expect, test } from '@playwright/test';
import { type LaunchedApp, launchApp } from './app';
import { type DevHost, dotnetAvailable, startDevHost } from './devHost';
import { totpCode } from './totp';

/**
 * The Deploy page against a real server core: the DevHost on loopback, reached through the same
 * REST client and health card the app uses for a server over SSH. Runs on every OS the suite
 * does, since it needs the .NET SDK but no Linux server.
 */

test.skip(!dotnetAvailable(), 'needs the .NET SDK to build the server core DevHost');

/** The DevHost's fixed development owner (see its DevHost.cs); the sign-in dialog says so too. */
const DEV_PASSWORD = 'agentmate-local-password';

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

test('signs in to the DevHost, turns two-factor on, and asks for a code from then on', async () => {
  if (!devHost) throw new Error('DevHost did not start');
  launched = await launchApp({
    settings: {},
    env: { AGENTMATE_DEPLOY_DEV_CORE: String(devHost.port) },
  });
  const { page } = launched;
  await page.getByRole('link', { name: 'Deploy' }).click();

  // The app enrolled itself with the DevHost; signing in takes the password alone for now.
  await expect(page.getByText('Sign in to manage this core.')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Sign in to DevHost' });
  await dialog.getByLabel('Password', { exact: true }).fill(DEV_PASSWORD);
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(/Signed in as/)).toBeVisible();
  await expect(page.getByText(/Two-factor is off/)).toBeVisible();

  // Two-factor: the password again, then a code from the key the dialog shows.
  await page.getByRole('button', { name: 'Turn on two-factor' }).click();
  dialog = page.getByRole('dialog', { name: 'Turn on two-factor' });
  await dialog.getByLabel('Password', { exact: true }).fill(DEV_PASSWORD);
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog.getByAltText('QR code with the new authenticator key')).toBeVisible();
  const key = (await dialog.getByLabel('Authenticator key').textContent()) ?? '';
  await dialog.getByLabel('Code from the app').fill(totpCode(key));
  await dialog.getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(
    dialog.getByRole('list', { name: 'Recovery codes' }).getByRole('listitem'),
  ).toHaveCount(10);
  await dialog.getByRole('button', { name: 'I saved them' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Two-factor is on: signing in/)).toBeVisible();

  // A new sign-in asks for a code too. The one that turned two-factor on is spent, so this
  // takes the next one the app would show.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Sign in to DevHost' });
  await dialog.getByLabel('Password', { exact: true }).fill(DEV_PASSWORD);
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await dialog.getByLabel('Authenticator code').fill(totpCode(key, 1));
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Signed in as/)).toBeVisible();
  await expect(page.getByText(/Two-factor is on: signing in/)).toBeVisible();
});

test('lists no DevHost when the app is not pointed at one', async () => {
  launched = await launchApp({ settings: {} });
  const { page } = launched;

  await page.getByRole('link', { name: 'Deploy' }).click();

  await expect(page.getByText('No servers yet')).toBeVisible();
});
