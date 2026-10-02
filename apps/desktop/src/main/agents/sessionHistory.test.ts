import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearHistoryCaches,
  collectHistory,
  type HistoryDirEntry,
  type HistoryFs,
  localHistoryFs,
} from './sessionHistory';

// collectHistory runs against an in-memory file tree, so the same checks cover the local reader
// and the remote one that plugs in later.

interface FakeFile {
  content: string;
  mtimeMs: number;
}

interface FakeOptions {
  home?: string;
  env?: Record<string, string>;
  caseInsensitive?: boolean;
  scope?: string;
}

type FakeFs = HistoryFs & {
  files: Map<string, FakeFile>;
  reads: { path: string; start: number; length: number }[];
};

function fakeFs(files: Record<string, FakeFile>, options: FakeOptions = {}): FakeFs {
  const map = new Map(Object.entries(files));
  const reads: FakeFs['reads'] = [];
  return {
    files: map,
    reads,
    scope: options.scope ?? 'fake',
    caseInsensitive: options.caseInsensitive ?? false,
    join: (...parts) => parts.join('/').replace(/\/+/g, '/'),
    home: async () => options.home ?? '/home/me',
    env: async (name) => options.env?.[name],
    list: async (dir) => {
      const prefix = `${dir.replace(/\/+$/, '')}/`;
      const entries = new Map<string, HistoryDirEntry>();
      for (const [path, file] of map) {
        if (!path.startsWith(prefix)) continue;
        const [name, ...rest] = path.slice(prefix.length).split('/');
        if (rest.length > 0) {
          entries.set(name, { name, isDirectory: true, isFile: false, size: 0, mtimeMs: 0 });
        } else {
          const size = Buffer.byteLength(file.content);
          entries.set(name, {
            name,
            isDirectory: false,
            isFile: true,
            size,
            mtimeMs: file.mtimeMs,
          });
        }
      }
      if (entries.size === 0) throw new Error(`ENOENT: ${dir}`);
      return [...entries.values()];
    },
    readRange: async (path, start, length) => {
      reads.push({ path, start, length });
      const file = map.get(path);
      if (!file) throw new Error(`ENOENT: ${path}`);
      return Buffer.from(file.content)
        .subarray(start, start + length)
        .toString('utf-8');
    },
  };
}

const jsonl = (...records: unknown[]): string =>
  `${records.map((r) => JSON.stringify(r)).join('\n')}\n`;

function claudeTranscript(cwd: string, prompt: string): string {
  return jsonl({
    type: 'user',
    cwd,
    timestamp: '2026-09-01T10:00:00.000Z',
    message: { role: 'user', content: prompt },
  });
}

function codexRollout(id: string, cwd: string, prompt: string, extraMeta = ''): string {
  return jsonl(
    {
      type: 'session_meta',
      payload: { id, cwd, timestamp: '2026-09-01T10:00:00.000Z', instructions: extraMeta },
    },
    { type: 'event_msg', payload: { type: 'user_message', message: prompt } },
  );
}

const claudeDir = '/home/me/.claude/projects';
const codexDir = '/home/me/.codex/sessions/2026/09/01';

const readPaths = (fs: FakeFs): string[] => [...new Set(fs.reads.map((r) => r.path))].sort();

beforeEach(() => {
  clearHistoryCaches();
});

describe('collectHistory for one folder', () => {
  it('returns only the folder sessions from Claude Code and Codex', async () => {
    const fs = fakeFs({
      [`${claudeDir}/-work-app/a.jsonl`]: {
        content: claudeTranscript('/work/app', 'Fix it'),
        mtimeMs: 10,
      },
      // Same encoded name, different real folder.
      [`${claudeDir}/-work-app/b.jsonl`]: {
        content: claudeTranscript('/work-app', 'Other'),
        mtimeMs: 20,
      },
      [`${claudeDir}/-work-other/c.jsonl`]: {
        content: claudeTranscript('/work/other', 'No'),
        mtimeMs: 30,
      },
      [`${codexDir}/rollout-1.jsonl`]: {
        content: codexRollout('x1', '/work/app', 'Codex yes'),
        mtimeMs: 40,
      },
      [`${codexDir}/rollout-2.jsonl`]: {
        content: codexRollout('x2', '/work/other', 'Codex no'),
        mtimeMs: 50,
      },
    });
    const sessions = await collectHistory(fs, { folder: '/work/app' });
    expect(sessions.map((s) => [s.provider, s.id, s.firstPrompt])).toEqual([
      ['codex', 'x1', 'Codex yes'],
      ['claude-code', 'a', 'Fix it'],
    ]);
    expect(sessions[0]).toMatchObject({ cwd: '/work/app', updatedAt: 40 });
  });

  it('matches folder names case sensitively unless the target ignores case', async () => {
    const files = {
      [`${claudeDir}/-work-app/a.jsonl`]: {
        content: claudeTranscript('/work/app', 'Hi'),
        mtimeMs: 1,
      },
    };
    expect(await collectHistory(fakeFs(files), { folder: '/Work/App' })).toEqual([]);
    clearHistoryCaches();
    const loose = await collectHistory(fakeFs(files, { caseInsensitive: true }), {
      folder: '/Work/App',
    });
    expect(loose.map((s) => s.id)).toEqual(['a']);
  });
});

describe('collectHistory for a whole machine', () => {
  it('returns sessions from every folder with their cwd', async () => {
    const fs = fakeFs({
      [`${claudeDir}/-work-app/a.jsonl`]: {
        content: claudeTranscript('/work/app', 'One'),
        mtimeMs: 10,
      },
      [`${claudeDir}/-srv-api/b.jsonl`]: {
        content: claudeTranscript('/srv/api', 'Two'),
        mtimeMs: 20,
      },
      [`${codexDir}/rollout-1.jsonl`]: {
        content: codexRollout('x1', '/opt/tool', 'Three'),
        mtimeMs: 30,
      },
    });
    const sessions = await collectHistory(fs);
    expect(sessions.map((s) => [s.provider, s.id, s.cwd])).toEqual([
      ['codex', 'x1', '/opt/tool'],
      ['claude-code', 'b', '/srv/api'],
      ['claude-code', 'a', '/work/app'],
    ]);
  });

  it('reads only the newest files that fit the limit', async () => {
    const files: Record<string, FakeFile> = {};
    for (let i = 0; i < 10; i++) {
      files[`${claudeDir}/-work-app/s${i}.jsonl`] = {
        content: claudeTranscript('/work/app', `Prompt ${i}`),
        mtimeMs: 100 + i,
      };
    }
    const fs = fakeFs(files);
    const sessions = await collectHistory(fs, { limit: 3 });
    expect(sessions.map((s) => s.id)).toEqual(['s9', 's8', 's7']);
    expect(readPaths(fs)).toEqual([
      `${claudeDir}/-work-app/s7.jsonl`,
      `${claudeDir}/-work-app/s8.jsonl`,
      `${claudeDir}/-work-app/s9.jsonl`,
    ]);
  });

  it('caps Codex rollouts before reading their first line', async () => {
    const files: Record<string, FakeFile> = {};
    for (let i = 0; i < 5; i++) {
      files[`${codexDir}/rollout-${i}.jsonl`] = {
        content: codexRollout(`x${i}`, `/p/${i}`, `Prompt ${i}`),
        mtimeMs: 100 + i,
      };
    }
    const fs = fakeFs(files);
    const sessions = await collectHistory(fs, { limit: 2 });
    expect(sessions.map((s) => s.id)).toEqual(['x4', 'x3']);
    expect(readPaths(fs).filter((p) => p.includes('rollout-'))).toEqual([
      `${codexDir}/rollout-3.jsonl`,
      `${codexDir}/rollout-4.jsonl`,
    ]);
  });
});

describe('collectHistory caching', () => {
  it('reuses summaries until the file changes', async () => {
    const path = `${claudeDir}/-work-app/a.jsonl`;
    const fs = fakeFs({ [path]: { content: claudeTranscript('/work/app', 'First'), mtimeMs: 1 } });
    await collectHistory(fs, { folder: '/work/app' });
    expect(fs.reads.length).toBeGreaterThan(0);

    fs.reads.length = 0;
    const again = await collectHistory(fs, { folder: '/work/app' });
    expect(again.map((s) => s.firstPrompt)).toEqual(['First']);
    expect(fs.reads).toEqual([]);

    fs.files.set(path, { content: claudeTranscript('/work/app', 'Second'), mtimeMs: 2 });
    const changed = await collectHistory(fs, { folder: '/work/app' });
    expect(changed.map((s) => s.firstPrompt)).toEqual(['Second']);
    expect(readPaths(fs)).toEqual([path]);
  });

  it('keeps caches apart per scope', async () => {
    const path = `${claudeDir}/-work-app/a.jsonl`;
    const files = { [path]: { content: claudeTranscript('/work/app', 'Hi'), mtimeMs: 1 } };
    await collectHistory(fakeFs(files, { scope: 'one' }));
    const other = fakeFs(files, { scope: 'two' });
    await collectHistory(other);
    expect(readPaths(other)).toEqual([path]);
  });
});

describe('collectHistory locations', () => {
  it('follows CLAUDE_CONFIG_DIR and CODEX_HOME', async () => {
    const fs = fakeFs(
      {
        '/cfg/claude/projects/-work-app/a.jsonl': {
          content: claudeTranscript('/work/app', 'Claude'),
          mtimeMs: 1,
        },
        '/cfg/codex/sessions/2026/09/01/rollout-1.jsonl': {
          content: codexRollout('x1', '/work/app', 'Codex'),
          mtimeMs: 2,
        },
      },
      { env: { CLAUDE_CONFIG_DIR: '/cfg/claude', CODEX_HOME: '/cfg/codex' } },
    );
    const sessions = await collectHistory(fs, { folder: '/work/app' });
    expect(sessions.map((s) => s.id)).toEqual(['x1', 'a']);
  });

  it('also reads the XDG Claude folder', async () => {
    const fs = fakeFs({
      '/home/me/.config/claude/projects/-work-app/a.jsonl': {
        content: claudeTranscript('/work/app', 'Claude'),
        mtimeMs: 1,
      },
    });
    expect((await collectHistory(fs)).map((s) => s.id)).toEqual(['a']);
  });

  it('returns nothing when no folder exists', async () => {
    const fs = fakeFs({});
    await expect(collectHistory(fs, { folder: '/work/app' })).resolves.toEqual([]);
    await expect(collectHistory(fs)).resolves.toEqual([]);
  });
});

describe('collectHistory for Codex', () => {
  it('parses a first line longer than the head chunk', async () => {
    const long = 'é'.repeat(100 * 1024);
    const fs = fakeFs({
      [`${codexDir}/rollout-1.jsonl`]: {
        content: codexRollout('x1', '/work/app', 'Long meta', long),
        mtimeMs: 1,
      },
    });
    const sessions = await collectHistory(fs, { folder: '/work/app', headBytes: 1024 });
    expect(sessions.map((s) => [s.id, s.firstPrompt])).toEqual([['x1', 'Long meta']]);

    clearHistoryCaches();
    const anywhere = await collectHistory(fs, { headBytes: 1024 });
    expect(anywhere.map((s) => [s.id, s.cwd])).toEqual([['x1', '/work/app']]);
  });

  it('titles sessions with the Codex thread name', async () => {
    const fs = fakeFs({
      [`${codexDir}/rollout-1.jsonl`]: {
        content: codexRollout('x1', '/work/app', 'Hi'),
        mtimeMs: 1,
      },
      [`${codexDir}/rollout-2.jsonl`]: {
        content: codexRollout('x2', '/work/app', 'Yo'),
        mtimeMs: 2,
      },
      '/home/me/.codex/session_index.jsonl': {
        content: jsonl(
          { id: 'x1', thread_name: 'Fix the login' },
          { id: 'zz', thread_name: 'Gone' },
        ),
        mtimeMs: 1,
      },
    });
    const sessions = await collectHistory(fs, { folder: '/work/app' });
    expect(sessions.map((s) => [s.id, s.title])).toEqual([
      ['x2', null],
      ['x1', 'Fix the login'],
    ]);
  });

  it('skips the thread index when no Codex session is kept', async () => {
    const fs = fakeFs({
      [`${claudeDir}/-work-app/a.jsonl`]: {
        content: claudeTranscript('/work/app', 'Hi'),
        mtimeMs: 1,
      },
      '/home/me/.codex/session_index.jsonl': {
        content: jsonl({ id: 'x1', thread_name: 'Name' }),
        mtimeMs: 1,
      },
    });
    await collectHistory(fs, { folder: '/work/app' });
    expect(readPaths(fs)).toEqual([`${claudeDir}/-work-app/a.jsonl`]);
  });
});

describe('localHistoryFs', () => {
  it('lists entries with sizes and reads byte ranges', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'history-'));
    try {
      await mkdir(join(dir, 'sub'));
      await writeFile(join(dir, 'a.jsonl'), 'héllo\nworld\n');
      const entries = await localHistoryFs.list(dir);
      const file = entries.find((e) => e.name === 'a.jsonl');
      expect(file).toMatchObject({ isFile: true, isDirectory: false, size: 13 });
      expect(file?.mtimeMs).toBeGreaterThan(0);
      expect(entries.find((e) => e.name === 'sub')).toMatchObject({ isDirectory: true });
      expect(await localHistoryFs.readRange(join(dir, 'a.jsonl'), 7, 5)).toBe('world');
      await expect(localHistoryFs.list(join(dir, 'missing'))).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
