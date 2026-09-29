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
