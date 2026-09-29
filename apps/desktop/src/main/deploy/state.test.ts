import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DeployCoreRecord } from '../../shared/deployTypes';
import { tempDir } from '../../test/main/fixtures';
import { DeployState, jsonFilePort } from './state';

/**
 * The app's own record of which core it installed on which server. It is a cache of facts the
 * server can always confirm again, so a damaged file costs a reinstall prompt, never a crash.
 */

const RECORD: DeployCoreRecord = {
  version: '1.53.0',
  release: '/opt/agentmate-core/releases/1.53.0-abababababab',
  transport: 'streamlocal',
  installedAt: 1_700_000_000_000,
  os: 'Ubuntu 24.04.1 LTS',
  architecture: 'x86_64',
};

function memoryFiles(initial: unknown = null) {
  let content: unknown = initial;
  const writes: unknown[] = [];
  return {
    writes,
    port: {
      read: async () => content,
      write: async (value: unknown) => {
        content = JSON.parse(JSON.stringify(value));
        writes.push(content);
      },
    },
  };
}

describe('DeployState', () => {
  it('starts empty', async () => {
    const state = new DeployState(memoryFiles().port);

    expect(await state.get('srv-1')).toBeNull();
    expect(await state.all()).toEqual({});
  });

  it('remembers a core per server and forgets it again', async () => {
    const state = new DeployState(memoryFiles().port);

    await state.set('srv-1', RECORD);
    await state.set('srv-2', { ...RECORD, transport: 'bridge' });
    await state.remove('srv-1');

    expect(await state.get('srv-1')).toBeNull();
    expect(await state.get('srv-2')).toEqual({ ...RECORD, transport: 'bridge' });
  });

  it('never loses one write to another running at the same time', async () => {
    const state = new DeployState(memoryFiles().port);

    await Promise.all([state.set('a', RECORD), state.set('b', RECORD), state.set('c', RECORD)]);

    expect(Object.keys(await state.all()).sort()).toEqual(['a', 'b', 'c']);
  });

  it('skips records it cannot read instead of failing', async () => {
    const state = new DeployState(
      memoryFiles({
        version: 1,
        cores: { good: RECORD, bad: { version: 7 }, worse: 'text' },
      }).port,
    );

    expect(await state.all()).toEqual({ good: RECORD });
  });

  it('treats a file from somewhere else as empty', async () => {
    for (const content of ['garbage', { version: 99, cores: { a: RECORD } }, [], 42]) {
      expect(await new DeployState(memoryFiles(content).port).all()).toEqual({});
    }
  });
});

describe('jsonFilePort', () => {
  it('reads nothing before the first write', async () => {
    expect(await jsonFilePort(join(tempDir(), 'deploy.json')).read()).toBeNull();
  });

  it('writes the whole file at once and reads it back', async () => {
    const path = join(tempDir(), 'nested', 'deploy.json');
    const port = jsonFilePort(path);

    await port.write({ version: 1, cores: {} });

    expect(JSON.parse(readFileSync(path, 'utf-8'))).toEqual({ version: 1, cores: {} });
    expect(await port.read()).toEqual({ version: 1, cores: {} });
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it('reads a damaged file as empty', async () => {
    const path = join(tempDir(), 'deploy.json');
    writeFileSync(path, '{ not json');

    expect(await jsonFilePort(path).read()).toBeNull();
  });
});
