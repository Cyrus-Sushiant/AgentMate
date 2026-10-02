import { afterEach, describe, expect, it, vi } from 'vitest';
import { sshErrorCode } from '../../shared/sshErrors';
import type { SshEndpoint } from './connectConfig';
import { SshConnection, TunnelRefusedError } from './connection';
import {
  echoStream,
  type FakeSshServer,
  type FakeSshServerOptions,
  type ForwardTarget,
  startFakeSshServer,
} from './testing/fakeSshServer';

/**
 * The non-interactive SSH connection the Deploy section runs on: commands with real exit codes,
 * stdin for secrets, and tunnels to the server core's socket.
 */

const PASSWORD = 'correct horse battery staple';

let server: FakeSshServer | null = null;
let connection: SshConnection | null = null;

afterEach(async () => {
  connection?.close();
  connection = null;
  await server?.close();
  server = null;
});

async function connect(
  options: FakeSshServerOptions = {},
  endpoint: Partial<SshEndpoint> = {},
  hooks: Parameters<typeof SshConnection.open>[1] = {},
): Promise<{ server: FakeSshServer; connection: SshConnection }> {
  server = await startFakeSshServer({ password: PASSWORD, ...options });
  connection = await SshConnection.open(
    {
      host: server.host,
      port: server.port,
      username: 'deploy',
      authMethod: 'password',
      password: PASSWORD,
      ...endpoint,
    },
    hooks,
  );
  return { server, connection };
}

function readAll(stream: NodeJS.ReadableStream, length: number): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      total += chunk.length;
      if (total >= length) resolve(Buffer.concat(chunks));
    });
  });
}

describe('SshConnection.exec', () => {
  it('returns stdout and stderr separately with the exit code', async () => {
    const { connection } = await connect({
      exec: () => ({ stdout: 'installed\n', stderr: 'warning: slow mirror\n', exitCode: 3 }),
    });

    const result = await connection.exec('apt-get install -y curl');

    expect(result).toEqual({
      stdout: 'installed\n',
      stderr: 'warning: slow mirror\n',
      exitCode: 3,
      signal: null,
      timedOut: false,
    });
  });

  it('sends stdin byte for byte and then closes it', async () => {
    const payload = Buffer.from([0, 1, 2, 255, 10, 13, 42]);
    const { connection, server } = await connect();

    await connection.exec('cat > /dev/null', { stdin: payload });

    expect(server.execRequests[0].stdin.equals(payload)).toBe(true);
  });

  it('closes stdin right away when there is nothing to send', async () => {
    const { connection, server } = await connect();

    const result = await connection.exec('true');

    expect(result.exitCode).toBe(0);
    expect(server.execRequests).toEqual([{ command: 'true', stdin: Buffer.alloc(0) }]);
  });

  it('gives up on a command that outlives its timeout', async () => {
    const { connection } = await connect({ exec: () => new Promise(() => undefined) });

    const result = await connection.exec('sleep 999', { timeoutMs: 100 });

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
  });

  it('counts the wait for the server to take the command against the timeout', async () => {
    const { connection } = await connect({ neverAnswer: 'commands' });

    const result = await connection.exec('true', { timeoutMs: 100 });

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
  });

  it('stops collecting output past the cap and says so', async () => {
    const { connection } = await connect({ exec: () => ({ stdout: 'x'.repeat(5000) }) });

    const result = await connection.exec('yes', { maxOutputBytes: 1000 });

    expect(result.stdout.length).toBeLessThan(1100);
    expect(result.stdout).toContain('[output truncated]');
  });

  it('keeps the exit code of a command that finishes in the same packet burst it started in', async () => {
    // The exec reply, the output and the exit status arrive together, so ssh2 reports the exit
    // before the caller could have attached a listener for it.
    const { connection } = await connect({
      interactiveExec: (_command, channel) => {
        channel.write('out\n');
        channel.stderr.write('err\n');
        channel.exit(7);
        channel.end();
        return true;
      },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await connection.exec('sh -c "exit 7"');

      expect(result).toMatchObject({ stdout: 'out\n', stderr: 'err\n', exitCode: 7 });
    }
  });

  it('streams output to callbacks as it arrives', async () => {
    const { connection } = await connect({
      exec: () => ({ stdout: 'step 1\nstep 2\n', exitCode: 0 }),
    });
    const lines: string[] = [];

    await connection.exec('install', { onStdout: (text) => lines.push(text) });

    expect(lines.join('')).toBe('step 1\nstep 2\n');
  });
});

describe('SshConnection.openStream', () => {
  it('tunnels to a Unix socket on the server', async () => {
    const targets: ForwardTarget[] = [];
    const { connection } = await connect({
      forward: (target) => {
        targets.push(target);
        return echoStream();
      },
    });

    const stream = await connection.openStream({ socketPath: '/run/agentmate-core/core.sock' });
    const echoed = readAll(stream, 5);
    stream.write('hello');

    expect((await echoed).toString()).toBe('hello');
    expect(targets).toEqual([{ kind: 'unix', path: '/run/agentmate-core/core.sock' }]);
    stream.destroy();
  });

  it('tunnels to a TCP port on the server', async () => {
    const targets: ForwardTarget[] = [];
    const { connection } = await connect({
      forward: (target) => {
        targets.push(target);
        return echoStream();
      },
    });

    const stream = await connection.openStream({ host: '127.0.0.1', port: 7810 });
    const echoed = readAll(stream, 4);
    stream.write('ping');

    expect((await echoed).toString()).toBe('ping');
    expect(targets).toEqual([{ kind: 'tcp', host: '127.0.0.1', port: 7810 }]);
    stream.destroy();
  });

  it('gives up on a tunnel the server never answers, without reading it as a refusal', async () => {
    const { connection } = await connect({ neverAnswer: 'tunnels' });

    const failure = await connection
      .openStream({ socketPath: '/run/agentmate-core/core.sock' }, { timeoutMs: 100 })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(TunnelRefusedError);
    expect(String(failure)).toMatch(/did not open within/);
  });

  it('explains a tunnel the server refused', async () => {
    const { connection } = await connect({ forward: () => null });

    await expect(
      connection.openStream({ socketPath: '/run/agentmate-core/core.sock' }),
    ).rejects.toThrow(/could not open a tunnel to \/run\/agentmate-core\/core\.sock/i);
  });
});

describe('SshConnection.openStream refusals', () => {
  it('marks a tunnel that sshd refuses by policy', async () => {
    const { connection } = await connect({ forwarding: 'prohibited' });

    const failure = await connection
      .openStream({ socketPath: '/run/x.sock' })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(TunnelRefusedError);
    expect((failure as TunnelRefusedError).prohibited).toBe(true);
  });

  it('tells a refusal by policy apart from nothing listening at the target', async () => {
    const { connection } = await connect({ forward: () => null });

    const failure = await connection
      .openStream({ socketPath: '/run/x.sock' })
      .catch((error) => error);

    expect(failure).toBeInstanceOf(TunnelRefusedError);
    expect((failure as TunnelRefusedError).prohibited).toBe(false);
  });
});

describe('SshConnection.openExecStream', () => {
  it('opens a two-way stream to a long-running command', async () => {
    const commands: string[] = [];
    const { connection } = await connect({
      interactiveExec: (command, channel) => {
        commands.push(command);
        channel.pipe(channel);
        return true;
      },
    });

    const stream = await connection.openExecStream('agentmate-core bridge');
    const echoed = readAll(stream, 5);
    stream.write('hello');

    expect((await echoed).toString()).toBe('hello');
    expect(commands).toEqual(['agentmate-core bridge']);
    stream.destroy();
  });

  it('gives up on a command stream the server never starts', async () => {
    const { connection } = await connect({ neverAnswer: 'commands' });

    await expect(
      connection.openExecStream('agentmate-core bridge', { timeoutMs: 100 }),
    ).rejects.toThrow(/did not start within/);
  });

  it('refuses work after the connection closed', async () => {
    const { connection } = await connect();
    connection.close();

    await expect(connection.openExecStream('agentmate-core bridge')).rejects.toThrow(/closed/);
  });
});

describe('SshConnection.createStagingDirectory', () => {
  it('returns the folder mktemp made', async () => {
    const { connection } = await connect({
      exec: ({ command }) => ({
        stdout: command.startsWith('mktemp -d') ? '/tmp/agentmate.Ab12Cd34Ef\n' : '',
      }),
    });

    expect(await connection.createStagingDirectory()).toBe('/tmp/agentmate.Ab12Cd34Ef');
  });

  it('refuses an answer that is not a fresh agentmate folder, since it gets removed later', async () => {
    for (const answer of ['/\n', '/tmp\n', 'agentmate.Ab12Cd34Ef\n', '/tmp/agentmate.x y\n']) {
      const { connection } = await connect({ exec: () => ({ stdout: answer }) });

      await expect(connection.createStagingDirectory()).rejects.toThrow(/staging folder/);
      connection.close();
      await server?.close();
    }
  });
});

describe('SshConnection lifecycle', () => {
  it('reports a first-use host key so it can be stored', async () => {
    const onHostKeyTrusted = vi.fn();
    const { server } = await connect({}, {}, { onHostKeyTrusted });

    expect(onHostKeyTrusted).toHaveBeenCalledWith(server.fingerprint());
  });

  it('refuses a changed host key with the coded error', async () => {
    server = await startFakeSshServer({ password: PASSWORD });
    const stored = server.fingerprint();
    await server.rotateHostKey();

    const failure = SshConnection.open({
      host: server.host,
      port: server.port,
      username: 'deploy',
      authMethod: 'password',
      password: PASSWORD,
      storedFingerprint: stored,
    });

    await expect(failure).rejects.toSatisfy((error) => sshErrorCode(error) === 'host-key-changed');
  });

  it('notices when the server goes away', async () => {
    const onClose = vi.fn();
    const { server, connection } = await connect({}, {}, { onClose });

    await server.close();

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(connection.isOpen).toBe(false);
  });

  it('refuses work after it was closed', async () => {
    const { connection } = await connect();
    connection.close();

    await expect(connection.exec('true')).rejects.toThrow(/closed/);
  });
});

/**
 * The fake server has no SFTP subsystem, so these hand the connection a stand-in session in its
 * place. Real SFTP is covered against OpenSSH in sshRemote.int.test.ts.
 */
interface FakeStats {
  mode: number;
  size?: number;
  mtime?: number;
  isDirectory: () => boolean;
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
}

type FakeNode =
  | { kind: 'dir'; mtime?: number }
  | { kind: 'file'; content: string; mtime?: number }
  | { kind: 'link'; target: string };

function stats(node: FakeNode): FakeStats {
  return {
    mode: 0,
    size: node.kind === 'file' ? Buffer.byteLength(node.content) : 4096,
    mtime: node.kind === 'link' ? 0 : node.mtime,
    isDirectory: () => node.kind === 'dir',
    isFile: () => node.kind === 'file',
    isSymbolicLink: () => node.kind === 'link',
  };
}

interface FakeSftpOptions {
  /** Most bytes one read hands back, like a server with a small packet size. */
  maxRead?: number;
  failRead?: boolean;
  /** Requests of these kinds are never answered. */
  hang?: ReadonlySet<string>;
}

function fakeSftp(tree: Record<string, FakeNode>, options: FakeSftpOptions = {}) {
  const handles = new Map<string, string>();
  const closed: string[] = [];
  const resolve = (path: string): FakeNode | undefined => {
    const node = tree[path];
    return node?.kind === 'link' ? tree[node.target] : node;
  };
  const answer = (kind: string, reply: () => void): void => {
    if (!options.hang?.has(kind)) setImmediate(reply);
  };
  const session = {
    readdir: (dir: string, cb: (error: Error | undefined, list?: unknown[]) => void) =>
      answer('readdir', () => {
        if (tree[dir]?.kind !== 'dir') return cb(new Error('No such file'));
        const prefix = dir.endsWith('/') ? dir : `${dir}/`;
        const list = Object.entries(tree)
          .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
          .map(([path, node]) => ({
            filename: path.slice(prefix.length),
            longname: '',
            attrs: stats(node),
          }));
        cb(undefined, list);
      }),
    stat: (path: string, cb: (error: Error | undefined, attrs?: FakeStats) => void) =>
      answer('stat', () => {
        const node = resolve(path);
        if (!node) return cb(new Error('No such file'));
        cb(undefined, stats(node));
      }),
    realpath: (path: string, cb: (error: Error | undefined, real?: string) => void) =>
      answer('realpath', () => cb(undefined, path === '.' ? '/home/deploy' : path)),
    open: (path: string, _flags: string, cb: (error: Error | undefined, h?: Buffer) => void) =>
      answer('open', () => {
        const node = resolve(path);
        if (node?.kind !== 'file') return cb(new Error('No such file'));
        const handle = `h${handles.size}`;
        handles.set(handle, node.content);
        cb(undefined, Buffer.from(handle));
      }),
    read: (
      handle: Buffer,
      buffer: Buffer,
      offset: number,
      length: number,
      position: number,
      cb: (error: Error | undefined, bytesRead?: number) => void,
    ) =>
      answer('read', () => {
        if (options.failRead) return cb(new Error('Failure'));
        const data = Buffer.from(handles.get(handle.toString()) ?? '');
        const size = Math.min(length, options.maxRead ?? length);
        const chunk = data.subarray(position, position + size);
        chunk.copy(buffer, offset);
        cb(undefined, chunk.length);
      }),
    close: (handle: Buffer, cb: (error?: Error) => void) => {
      closed.push(handle.toString());
      setImmediate(() => cb());
    },
  };
  return { session, closed };
}

/** Makes the connection's SFTP session `session`, failing the first `failures` starts. */
function useSftp(connection: SshConnection, session: unknown, failures = 0) {
  const client = (connection as unknown as { client: { sftp: (cb: unknown) => void } }).client;
  let attempts = 0;
  return vi.spyOn(client, 'sftp').mockImplementation((cb: unknown) => {
    attempts += 1;
    const done = cb as (error: Error | undefined, session?: unknown) => void;
    if (attempts <= failures) setImmediate(() => done(new Error('Unable to start subsystem')));
    else setImmediate(() => done(undefined, session));
  });
}

describe('SshConnection.sftpList', () => {
  it('lists folders and files with their size and mtime in milliseconds', async () => {
    const { connection } = await connect();
    const { session } = fakeSftp({
      '/srv': { kind: 'dir' },
      '/srv/app': { kind: 'dir', mtime: 50 },
      '/srv/a.jsonl': { kind: 'file', content: 'hello', mtime: 1_700_000_000 },
    });
    useSftp(connection, session);

    const entries = await connection.sftpList('/srv');

    expect(entries.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'a.jsonl', isDirectory: false, isFile: true, size: 5, mtimeMs: 1_700_000_000_000 },
      { name: 'app', isDirectory: true, isFile: false, size: 4096, mtimeMs: 50_000 },
    ]);
  });

  it('counts a link as what it points at and skips a dangling one', async () => {
    const { connection } = await connect();
    const { session } = fakeSftp({
      '/srv': { kind: 'dir' },
      '/data/real.jsonl': { kind: 'file', content: 'abc', mtime: 7 },
      '/srv/linked.jsonl': { kind: 'link', target: '/data/real.jsonl' },
      '/srv/broken.jsonl': { kind: 'link', target: '/data/gone.jsonl' },
    });
    useSftp(connection, session);

    const entries = await connection.sftpList('/srv');

    expect(entries).toEqual([
      { name: 'linked.jsonl', isDirectory: false, isFile: true, size: 3, mtimeMs: 7000 },
    ]);
  });

  it('rejects for a folder that is not there', async () => {
    const { connection } = await connect();
    useSftp(connection, fakeSftp({}).session);

    await expect(connection.sftpList('/nope')).rejects.toThrow(/No such file/);
  });

  it('gives up on a server that never answers', async () => {
    const { connection } = await connect();
    const { session } = fakeSftp({ '/srv': { kind: 'dir' } }, { hang: new Set(['readdir']) });
    useSftp(connection, session);

    await expect(connection.sftpList('/srv', { timeoutMs: 50 })).rejects.toThrow(/did not answer/);
  });

  it('starts SFTP again after a failed start', async () => {
    const { connection } = await connect();
    const spy = useSftp(connection, fakeSftp({ '/srv': { kind: 'dir' } }).session, 1);

    await expect(connection.sftpList('/srv')).rejects.toThrow(/subsystem/);
    await expect(connection.sftpList('/srv')).resolves.toEqual([]);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('SshConnection.sftpReadRange', () => {
  it('reads the range across short reads', async () => {
    const { connection } = await connect();
    const { session, closed } = fakeSftp(
      { '/f.txt': { kind: 'file', content: 'hello wonderful world' } },
      { maxRead: 3 },
    );
    useSftp(connection, session);

    const bytes = await connection.sftpReadRange('/f.txt', 6, 9);

    expect(bytes.toString()).toBe('wonderful');
    expect(closed).toEqual(['h0']);
  });

  it('stops at the end of a file that is shorter than asked', async () => {
    const { connection } = await connect();
    useSftp(connection, fakeSftp({ '/f.txt': { kind: 'file', content: 'short' } }).session);

    const bytes = await connection.sftpReadRange('/f.txt', 2, 1000);

    expect(bytes.toString()).toBe('ort');
  });

  it('closes the file when a read fails', async () => {
    const { connection } = await connect();
    const { session, closed } = fakeSftp(
      { '/f.txt': { kind: 'file', content: 'data' } },
      { failRead: true },
    );
    useSftp(connection, session);

    await expect(connection.sftpReadRange('/f.txt', 0, 4)).rejects.toThrow(/Failure/);
    expect(closed).toEqual(['h0']);
  });

  it('gives up on a read that never comes back', async () => {
    const { connection } = await connect();
    const { session } = fakeSftp(
      { '/f.txt': { kind: 'file', content: 'data' } },
      { hang: new Set(['read']) },
    );
    useSftp(connection, session);

    await expect(connection.sftpReadRange('/f.txt', 0, 4, { timeoutMs: 50 })).rejects.toThrow(
      /did not answer/,
    );
  });
});

describe('SshConnection.sftpRealpath', () => {
  it('resolves a path on the server', async () => {
    const { connection } = await connect();
    useSftp(connection, fakeSftp({}).session);

    await expect(connection.sftpRealpath('.')).resolves.toBe('/home/deploy');
  });
});
