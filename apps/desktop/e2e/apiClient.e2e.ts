import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { type LaunchedApp, launchApp } from './app';

/**
 * The API Client end to end: a request goes from the page, through main, into the utility
 * process that runs Postman's runtime, out to a real HTTP server, and back. Then it is saved into
 * a collection on disk and survives a reload.
 */

let launched: LaunchedApp | undefined;
let server: Server | undefined;

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

async function startEchoServer(): Promise<string> {
  server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      response.writeHead(200, { 'Content-Type': 'application/json', 'X-Echo': 'yes' });
      response.end(JSON.stringify({ method: request.method, url: request.url, body }));
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

test('sends a request, shows the response, and saves it into a collection', async () => {
  const base = await startEchoServer();
  launched = await launchApp({ settings: {} });
  const { page, userDataDir } = launched;

  await page.getByRole('link', { name: 'API Client' }).click();
  await expect(page.getByText('No collections yet')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'New request', exact: true }).click();

  await page.getByRole('textbox', { name: 'Request URL' }).fill(`${base}/users?page=2`);
  await page.getByRole('button', { name: /^Send/ }).click();

  // The first send starts the engine process, which takes a moment.
  await expect(page.getByText('200 OK')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('radio', { name: 'Raw' }).click();
  await expect(page.getByText('"url":"/users?page=2"')).toBeVisible();
  await page
    .getByRole('tab', { name: /Headers/ })
    .last()
    .click();
  await expect(page.getByRole('table', { name: 'Response headers' })).toContainText('x-echo');

  await page.getByRole('button', { name: /^Save/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Save request' });
  await dialog.getByRole('textbox', { name: 'Request name' }).fill('List users');
  await dialog.getByRole('textbox', { name: 'New collection name' }).fill('E2E API');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('tab', { name: 'GET List users' })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'E2E API' })).toBeVisible();

  const index = JSON.parse(
    readFileSync(join(userDataDir, 'data', 'api-client', 'index.json'), 'utf-8'),
  ) as { collections: { id: string; name: string }[] };
  expect(index.collections.map((c) => c.name)).toEqual(['E2E API']);
  const saved = readFileSync(
    join(userDataDir, 'data', 'api-client', 'collections', `${index.collections[0]?.id}.json`),
    'utf-8',
  );
  expect(saved).toContain(`${base}/users?page=2`);

  await page.reload();
  await page.getByRole('treeitem', { name: 'E2E API' }).click({ timeout: 30_000 });
  await page.getByRole('treeitem', { name: 'GET List users' }).click();
  await expect(page.getByRole('textbox', { name: 'Request URL' })).toHaveValue(
    `${base}/users?page=2`,
  );
});

test('explains a request that cannot reach its server', async () => {
  launched = await launchApp({ settings: {} });
  const { page } = launched;

  await page.getByRole('link', { name: 'API Client' }).click();
  await page.getByRole('button', { name: 'New request', exact: true }).click({ timeout: 30_000 });
  // Port 9 (discard) is closed on any machine that runs the suite.
  await page.getByRole('textbox', { name: 'Request URL' }).fill('http://127.0.0.1:9/nothing');
  await page.keyboard.press('Control+Enter');

  await expect(page.getByText('Could not get a response')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/ECONNREFUSED/)).toBeVisible();
});
