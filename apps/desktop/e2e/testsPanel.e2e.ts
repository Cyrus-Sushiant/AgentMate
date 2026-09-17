import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { type LaunchedApp, launchApp, openWorkspace } from './app';

/**
 * The workspace Tests tab in the real app: discovery of a project's tests, background runs through
 * the real main process and command line, results in the tree, Copy issue, Fix with AI handing the
 * failure to Claude Code, stopping a run, and a runner that is not installed.
 *
 * The project's `node_modules/.bin/vitest` is a Node script that writes a Vitest JSON report, so no
 * real Vitest is needed. It logs the arguments it gets, and a `slow.flag` file makes it hang.
 */

const FAKE_VITEST = `
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(path.join(process.cwd(), 'vitest-args.log'), JSON.stringify(args) + '\\n');
console.log(' RUN  v9.9.9 fake vitest');
if (fs.existsSync(path.join(process.cwd(), 'slow.flag'))) {
  console.log('waiting forever');
  setInterval(() => {}, 1000);
} else {
  const out = (args.find((a) => a.startsWith('--outputFile.json=')) || '').slice('--outputFile.json='.length);
  const results = [
    { ancestorTitles: ['math'], title: 'adds', status: 'passed', duration: 2, failureMessages: [] },
    { ancestorTitles: ['math'], title: 'breaks', status: 'failed', duration: 3,
      failureMessages: ['AssertionError: expected 1 to be 2\\n    at src/math.test.ts:3:13'] },
  ];
  const pattern = args[args.indexOf('-t') + 1];
  const picked = args.includes('-t') ? results.filter((r) => new RegExp(pattern).test([...r.ancestorTitles, r.title].join(' '))) : results;
  fs.writeFileSync(out, JSON.stringify({ testResults: [{ name: path.join(process.cwd(), 'src', 'math.test.ts'), status: 'failed', message: '', assertionResults: picked }] }));
  console.log(' FAIL  src/math.test.ts > math > breaks');
  process.exit(picked.some((r) => r.status === 'failed') ? 1 : 0);
}
`;

let launched: LaunchedApp | undefined;

test.afterEach(async () => {
  await launched?.close();
  launched = undefined;
});

function write(root: string, path: string, content: string): void {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function seedVitestProject(projectDir: string): void {
  write(
    projectDir,
    'package.json',
    JSON.stringify({ name: 'e2e', devDependencies: { vitest: '5' } }),
  );
  write(
    projectDir,
    'src/math.test.ts',
    "describe('math', () => {\n  it('adds', () => {});\n  it('breaks', () => {});\n});\n",
  );
  write(projectDir, 'fake-vitest.js', FAKE_VITEST);
  if (process.platform === 'win32') {
    write(
      projectDir,
      'node_modules/.bin/vitest.cmd',
      '@node "%~dp0\\..\\..\\fake-vitest.js" %*\r\n',
    );
  } else {
    const shim = join(projectDir, 'node_modules/.bin/vitest');
    write(
      projectDir,
      'node_modules/.bin/vitest',
      '#!/bin/sh\nexec node "$(dirname "$0")/../../fake-vitest.js" "$@"\n',
    );
    chmodSync(shim, 0o755);
  }
}

function vitestArgs(projectDir: string): string[][] {
  const log = join(projectDir, 'vitest-args.log');
  return existsSync(log)
    ? readFileSync(log, 'utf-8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
}

async function openTestsTab(page: Page): Promise<void> {
  const tab = page.getByRole('tab', { name: 'Tests' });
  await expect(tab).toBeVisible({ timeout: 60_000 });
  await tab.click();
}

const testRow = (page: Page, name: string) =>
  page
    .getByRole('treeitem')
    .filter({ has: page.locator('[data-test-name]', { hasText: new RegExp(`^${name}$`) }) });

async function startWithVitest(): Promise<LaunchedApp> {
  const app = await launchApp({ settings: { defaultCliId: 'claude-code' } });
  seedVitestProject(app.projectDir);
  await openWorkspace(app);
  await openTestsTab(app.page);
  await expect(testRow(app.page, 'breaks')).toBeVisible({ timeout: 60_000 });
  return app;
}

async function runAllAndWait(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Run all tests' }).click();
  await expect(page.getByText('1 failed', { exact: true })).toBeVisible({ timeout: 60_000 });
}

test('lists the project tests and runs them all in the background', async () => {
  launched = await startWithVitest();
  const { page, projectDir } = launched;

  await expect(testRow(page, 'Vitest')).toBeVisible();
  await expect(testRow(page, 'src/math.test.ts')).toBeVisible();
  await expect(testRow(page, 'adds')).toBeVisible();

  // The run buttons sit on their own row under the tab icons, not squeezed in beside them.
  const tabStrip = page.getByRole('tablist', { name: 'Panel sections' }).locator('..');
  await expect(tabStrip.getByRole('button', { name: 'Run all tests' })).toHaveCount(0);
  const runAll = page.getByRole('button', { name: 'Run all tests' });
  await expect(runAll).toBeVisible();
  const stripBox = await tabStrip.boundingBox();
  const runAllBox = await runAll.boundingBox();
  expect(runAllBox && stripBox && runAllBox.y >= stripBox.y + stripBox.height).toBe(true);

  await runAllAndWait(page);
  await expect(page.getByText('1 passed', { exact: true })).toBeVisible();
  await expect(testRow(page, 'adds').getByLabel('Passed')).toBeVisible();
  await expect(testRow(page, 'breaks').getByLabel('Failed')).toBeVisible();
  await expect(page.getByText('AssertionError: expected 1 to be 2')).toBeVisible();
  // The tab badge counts the failure.
  await expect(page.getByRole('tab', { name: 'Tests' })).toContainText('1');

  expect(vitestArgs(projectDir)[0].slice(0, 3)).toEqual([
    'run',
    '--reporter=default',
    '--reporter=json',
  ]);

  await page.getByRole('button', { name: 'Show output' }).click();
  await expect(page.getByLabel('Test output')).toContainText('FAIL  src/math.test.ts');
});

test('runs a single test by its exact name', async () => {
  launched = await startWithVitest();
  const { page, projectDir } = launched;
  const row = testRow(page, 'adds');
  await row.hover();
  await row.getByRole('button', { name: 'Run adds' }).click();
  await expect(row.getByLabel('Passed')).toBeVisible({ timeout: 60_000 });
  await expect(testRow(page, 'breaks').getByLabel('Not run')).toBeVisible();
  expect(vitestArgs(projectDir)[0].slice(4)).toEqual([
    'src/math.test.ts',
    '-t',
    '^(?:math(?: | > )adds)$',
  ]);
});

test('copies an issue for a failing test', async () => {
  launched = await startWithVitest();
  const { app, page } = launched;
  await runAllAndWait(page);
  await page.getByRole('button', { name: 'Copy issue' }).click();
  await expect
    .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()), { timeout: 20_000 })
    .toContain('Failing test: math > breaks');
  const text = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(text).toContain('File: src/math.test.ts:3');
  expect(text).toContain("src/math.test.ts -t '^(?:math(?: | > )breaks)$'");
  expect(text).toMatch(/Run it: .*vitest.* run /);
  expect(text).toContain('AssertionError: expected 1 to be 2');
});

test('hands a failing test to Claude Code with Fix with AI', async () => {
  launched = await startWithVitest();
  const { page } = launched;
  await runAllAndWait(page);

  await page
    .getByRole('group', { name: 'math > breaks failure' })
    .getByRole('button', { name: 'Fix with AI' })
    .click();
  const prompt = page.getByLabel('Fix prompt');
  await expect(prompt).toBeVisible({ timeout: 30_000 });
  await expect(prompt).toHaveValue(
    /A test is failing in this repository: math > breaks \(src\/math\.test\.ts:3, Vitest\)\./,
  );
  await expect(prompt).toHaveValue(/AssertionError: expected 1 to be 2/);

  const before = launched.claudeLaunches().length;
  await page
    .getByRole('button', { name: /^(Open in Claude Code|Run on )/ })
    .first()
    .click();
  await expect(prompt).toBeHidden();
  // The model sizing runs claude headless (-p); the fix itself opens an interactive tab.
  const interactive = () =>
    (launched?.claudeLaunches().slice(before) ?? []).filter(
      (line) => !/(^|\s)(-p|--print)(\s|$)/.test(line),
    );
  await expect.poll(() => interactive().length, { timeout: 60_000 }).toBeGreaterThan(0);
});

test('stops a run that is going', async () => {
  launched = await startWithVitest();
  const { page, projectDir } = launched;
  writeFileSync(join(projectDir, 'slow.flag'), '');
  await page.getByRole('button', { name: 'Run all tests' }).click();
  await expect(page.getByText(/Running 2 tests/)).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => vitestArgs(projectDir).length, { timeout: 30_000 }).toBe(1);
  await page.getByRole('button', { name: 'Stop tests' }).click();
  await expect(page.getByText('Stopped', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Run all tests' })).toBeVisible();
  await expect(testRow(page, 'adds').getByLabel('Not run')).toBeVisible();
});

const rspecInstalled = (() => {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', ['rspec'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

test('says when a project test runner is not installed', async () => {
  test.skip(rspecInstalled, 'needs a machine without rspec');
  launched = await launchApp({ settings: { defaultCliId: 'claude-code' } });
  const { page, projectDir } = launched;
  write(projectDir, '.rspec', '--require spec_helper\n');
  write(projectDir, 'spec/user_spec.rb', "describe 'User' do\n  it 'works' do\n  end\nend\n");
  await openWorkspace(launched);
  await openTestsTab(page);
  await expect(testRow(page, 'works')).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: 'Run all tests' }).click();
  const card = page.getByRole('group', { name: 'RSpec could not run' });
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card).toContainText('Check that it is installed');
  await expect(card.getByRole('button', { name: 'Fix with AI' })).toHaveCount(0);
});

test('shows an empty state for a project without tests', async () => {
  launched = await launchApp({ settings: { defaultCliId: 'claude-code' } });
  write(launched.projectDir, 'README.md', '# nothing to test\n');
  await openWorkspace(launched);
  await openTestsTab(launched.page);
  await expect(launched.page.getByText('No tests found')).toBeVisible({ timeout: 60_000 });
});
