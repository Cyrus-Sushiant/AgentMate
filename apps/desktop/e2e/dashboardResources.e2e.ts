import { expect, test } from '@playwright/test';
import { type LaunchedApp, launchApp } from './app';

/**
 * The Docker and emulator cards read what the machine happens to be running, so nothing here
 * depends on Docker being installed. What is checked is that both cards are on a dashboard that
 * predates them, that they stop shimmering once the first reading is back, and that the idle time
 * and alert choice save to the profile and show up on the Settings page too.
 */

let launched: LaunchedApp | undefined;

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
});

test('both cards are on the Dashboard and the idle time can be changed from the card', async () => {
  launched = await launchApp({});
  const current = launched;
  const { page } = current;

  await page.evaluate(() => {
    window.location.hash = '#/';
  });
  await expect(page.getByText('Docker and Emulator Usage', { exact: true })).toBeVisible();
  await expect(page.getByText('Idle Docker and Emulators', { exact: true })).toBeVisible();
  // The headline replaces the shimmer once the first reading is back, whatever is running here.
  await expect(page.getByText(/^idle of \d+ running$/)).toBeVisible({ timeout: 45_000 });

  await page.getByRole('button', { name: 'Idle settings' }).click();
  const minutes = page.getByLabel('List as idle after');
  await expect(minutes).toHaveValue('20');
  await minutes.fill('45');
  await minutes.press('Enter');
  await expect.poll(() => current.settingsOnDisk().idleResourceMinutes).toBe(45);

  const alerts = page.getByRole('switch', { name: 'Notify me when something goes idle' });
  await expect(alerts).toBeChecked();
  await alerts.click();
  await expect.poll(() => current.settingsOnDisk().idleResourceNotify).toBe(false);

  // The line under the headline follows the new threshold without waiting for another reading.
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Idle after 45 min/)).toBeVisible();
});

test('the Settings page shows and saves the same two options', async () => {
  launched = await launchApp({ settings: { idleResourceMinutes: 90, idleResourceNotify: false } });
  const current = launched;
  const { page } = current;

  await page.evaluate(() => {
    window.location.hash = '#/settings?tab=general';
  });
  const minutes = page.getByRole('spinbutton', {
    name: 'Minutes before a container or emulator counts as idle',
  });
  await expect(minutes).toHaveValue('90');
  const alerts = page.getByRole('switch', {
    name: 'Notify when a container or emulator goes idle',
  });
  await expect(alerts).not.toBeChecked();

  await minutes.fill('0');
  await minutes.press('Enter');
  // Below the range it is moved to the nearest allowed value rather than saved as it was typed.
  await expect.poll(() => current.settingsOnDisk().idleResourceMinutes).toBe(1);
  await alerts.click();
  await expect.poll(() => current.settingsOnDisk().idleResourceNotify).toBe(true);
});
