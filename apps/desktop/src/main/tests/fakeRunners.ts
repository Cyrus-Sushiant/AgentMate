import { chmodSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Test helpers only: Node scripts that stand in for real test runners, so the main process runs
 * real child processes through the same command lines without needing Vitest or Go installed.
 * FAKE_VITEST reads FAKE_ARGS_LOG, FAKE_VITEST_MODE (report, crash, slow) and FAKE_PID_FILE.
 */

const onWindows = process.platform === 'win32';

export const FAKE_VITEST = `
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_ARGS_LOG, JSON.stringify(args) + '\\n');
const mode = process.env.FAKE_VITEST_MODE || 'report';
const out = (args.find((a) => a.startsWith('--outputFile.json=')) || '').slice('--outputFile.json='.length);
console.log(' RUN  v0.0.0 fake');
if (mode === 'crash') {
  console.error('SyntaxError: Unexpected token (3:4)');
  process.exit(1);
}
if (mode === 'slow') {
  const { spawn } = require('node:child_process');
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  fs.writeFileSync(process.env.FAKE_PID_FILE, String(child.pid));
  console.log('waiting');
  setInterval(() => {}, 1000);
} else {
  const file = path.join(process.cwd(), 'src', 'math.test.ts');
  const all = [
    { ancestorTitles: ['math'], title: 'adds', status: 'passed', duration: 2, failureMessages: [] },
    { ancestorTitles: ['math'], title: 'breaks', status: 'failed', duration: 3,
      failureMessages: ['AssertionError: expected 1 to be 2\\n    at src/math.test.ts:3:13'] },
  ];
  // Like real Vitest 3+: -t matches "suite > test", and tests it leaves out come back as skipped.
  const filter = args.includes('-t') ? new RegExp(args[args.indexOf('-t') + 1]) : null;
  const assertionResults = all.map((test) =>
    !filter || filter.test([...test.ancestorTitles, test.title].join(' > '))
      ? test
      : { ...test, status: 'skipped', duration: 0, failureMessages: [] },
  );
  fs.writeFileSync(out, JSON.stringify({
    testResults: [{ name: file, status: 'failed', message: '', assertionResults }],
  }));
  console.log(' FAIL src/math.test.ts > math > breaks');
  process.exit(assertionResults.some((test) => test.status === 'failed') ? 1 : 0);
}
`;

export const FAKE_GO = `
const events = [
  { Action: 'run', Package: 'example.com/svc/calc', Test: 'TestAdd' },
  { Action: 'output', Package: 'example.com/svc/calc', Test: 'TestAdd', Output: '=== RUN   TestAdd\\n', OutputType: 'frame' },
  { Action: 'pass', Package: 'example.com/svc/calc', Test: 'TestAdd', Elapsed: 0.01 },
  { Action: 'output', Package: 'example.com/svc/calc', Test: 'TestSub', Output: '    calc_test.go:7: want 1\\n' },
  { Action: 'fail', Package: 'example.com/svc/calc', Test: 'TestSub', Elapsed: 0 },
  { Action: 'fail', Package: 'example.com/svc/calc', Elapsed: 0.2 },
];
let i = 0;
const tick = () => {
  if (i >= events.length) return process.exit(1);
  console.log(JSON.stringify(events[i++]));
  setTimeout(tick, i === 3 ? 400 : 5);
};
tick();
`;

export async function write(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf-8');
}

/** A command shim that runs a Node script, the way node_modules/.bin shims do. */
export async function shim(path: string, script: string): Promise<void> {
  if (onWindows) {
    await write(`${path}.cmd`, `@node "${script}" %*\r\n`);
  } else {
    await write(path, `#!/bin/sh\nexec node "${script}" "$@"\n`);
    chmodSync(path, 0o755);
  }
}

/** A workspace with a Vitest package (backed by FAKE_VITEST) and a Go module. */
export async function seedWorkspace(root: string): Promise<void> {
  await write(
    join(root, 'web', 'package.json'),
    JSON.stringify({ devDependencies: { vitest: '5' } }),
  );
  await write(
    join(root, 'web', 'src', 'math.test.ts'),
    [
      "describe('math', () => {",
      "  it('adds', () => {});",
      "  it('breaks', () => {});",
      '});',
      '',
    ].join('\n'),
  );
  await write(join(root, 'web', 'fake-vitest.js'), FAKE_VITEST);
  await shim(
    join(root, 'web', 'node_modules', '.bin', 'vitest'),
    join(root, 'web', 'fake-vitest.js'),
  );
  await write(
    join(root, 'svc', 'go.mod'),
    ['module example.com/svc', '', 'go 1.22', ''].join('\n'),
  );
  await write(
    join(root, 'svc', 'calc', 'calc_test.go'),
    [
      'package calc',
      '',
      'func TestAdd(t *testing.T) {}',
      '',
      'func TestSub(t *testing.T) {}',
      '',
    ].join('\n'),
  );
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function waitFor(check: () => boolean, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
