import { randomUUID } from 'node:crypto';
import type { Duplex } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { Client, type ClientChannel, type SFTPWrapper } from 'ssh2';
import { buildConnectConfig, friendlyConnectError, type SshEndpoint } from './connectConfig';

/**
 * A non-interactive SSH connection: commands with real exit codes, stdin for anything secret,
 * atomic uploads, and tunnels. The Deploy section installs and reaches the server core through
 * this; interactive terminals keep using `SshSessionManager`.
 */

export interface SshConnectionHooks {
  /** Fires on a first connect, so the caller can store the fingerprint it just trusted. */
  onHostKeyTrusted?: (fingerprint: string) => void;
  /** Fires once when the connection ends, whoever ended it. */
  onClose?: () => void;
}

export interface ExecOptions {
  /** Written to the command's stdin, then stdin is closed. Secrets go here, never in the command. */
  stdin?: Buffer | string;
  timeoutMs?: number;
  /** Per stream. Output beyond it is dropped and marked as truncated. */
  maxOutputBytes?: number;
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  /** Null when the command was killed by a signal or given up on. */
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
}

export type TunnelTarget = { socketPath: string } | { host: string; port: number };

export interface UploadOptions {
  mode?: number;
  onProgress?: (sentBytes: number, totalBytes: number) => void;
}

/** SSH's reason code when sshd refuses a channel by policy (RFC 4254, section 5.1). */
const ADMINISTRATIVELY_PROHIBITED = 1;

/** A tunnel the server would not open. `prohibited` means sshd's configuration forbids it. */
export class TunnelRefusedError extends Error {
  readonly prohibited: boolean;

  constructor(message: string, reason: unknown) {
    super(message);
    this.name = 'TunnelRefusedError';
    this.prohibited = reason === ADMINISTRATIVELY_PROHIBITED;
  }
}

const KEEPALIVE_INTERVAL_MS = 15_000;
const KEEPALIVE_COUNT_MAX = 3;
const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const UPLOAD_CHUNK_BYTES = 32 * 1024;
/** What `mktemp -d -t agentmate.XXXXXXXXXX` prints: an absolute path ending in that name. */
const STAGING_DIRECTORY = /^\/[^\s'"]*\/agentmate\.[A-Za-z0-9]{6,}$/;
const TRUNCATED = '\n[output truncated]\n';

class OutputCollector {
  private readonly chunks: Buffer[] = [];
  private size = 0;
  private truncated = false;
  private readonly decoder = new StringDecoder('utf8');

  constructor(
    private readonly limit: number,
    private readonly onText?: (text: string) => void,
  ) {}

  push(chunk: Buffer): void {
    if (this.onText) {
      const text = this.decoder.write(chunk);
      if (text) this.onText(text);
    }
    if (this.truncated) return;
    const room = this.limit - this.size;
    if (chunk.length > room) {
      this.chunks.push(chunk.subarray(0, room));
      this.size = this.limit;
      this.truncated = true;
      return;
    }
    this.chunks.push(chunk);
    this.size += chunk.length;
  }

  text(): string {
    const text = Buffer.concat(this.chunks).toString('utf8');
    return this.truncated ? `${text}${TRUNCATED}` : text;
  }
}

function describeTarget(target: TunnelTarget): string {
  return 'socketPath' in target ? target.socketPath : `${target.host}:${target.port}`;
}

export class SshConnection {
  private closed = false;
  private sftpSession: Promise<SFTPWrapper> | null = null;
  /**
   * Rejects when the connection ends. ssh2 never calls back SFTP requests that were in flight
   * when the connection dropped, so every step of an upload races against this.
   */
  private readonly closedSignal: Promise<never>;
  private signalClosed: (error: Error) => void = () => undefined;

  private constructor(
    private readonly client: Client,
    readonly endpoint: SshEndpoint,
  ) {
    this.closedSignal = new Promise<never>((_resolve, reject) => {
      this.signalClosed = reject;
    });
    // Nobody may be racing against it when it fires; that is not an unhandled rejection.
    this.closedSignal.catch(() => undefined);
  }

  static async open(endpoint: SshEndpoint, hooks: SshConnectionHooks = {}): Promise<SshConnection> {
    const { config, verdict } = await buildConnectConfig(endpoint, {
      keepaliveInterval: KEEPALIVE_INTERVAL_MS,
      keepaliveCountMax: KEEPALIVE_COUNT_MAX,
    });
    const client = new Client();
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        client.end();
        reject(friendlyConnectError(error, endpoint, verdict));
      };
      client.once('error', onError);
      client.once('ready', () => {
        client.off('error', onError);
        resolve();
      });
      client.connect(config);
    });

    const connection = new SshConnection(client, endpoint);
    // After the handshake, a failure ends the connection and 'close' reports it.
    client.on('error', () => undefined);
    client.on('close', () => {
      connection.markClosed();
      hooks.onClose?.();
    });
    if (verdict.trustedFingerprint) hooks.onHostKeyTrusted?.(verdict.trustedFingerprint);
    return connection;
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    this.assertOpen();
    const channel = await new Promise<ClientChannel>((resolve, reject) => {
      this.client.exec(command, (error, stream) => (error ? reject(error) : resolve(stream)));
    });

    return new Promise((resolve) => {
      const limit = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
      const stdout = new OutputCollector(limit, options.onStdout);
      const stderr = new OutputCollector(limit, options.onStderr);
      let exitCode: number | null = null;
      let signal: string | null = null;
      let timedOut = false;
      let settled = false;

      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          stdout: stdout.text(),
          stderr: stderr.text(),
          exitCode: timedOut ? null : exitCode,
          signal,
          timedOut,
        });
      };
      const timer = setTimeout(() => {
        timedOut = true;
        channel.close();
        finish();
      }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

      channel.on('data', (chunk: Buffer) => stdout.push(chunk));
      channel.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
      channel.on('exit', (code: number | null, signalName?: string) => {
        exitCode = code ?? null;
        signal = signalName ?? null;
      });
      // A command that finishes at once can have its exit status parsed in the same burst as the
      // exec reply, before this listener exists. ssh2 repeats the status on 'close', which only
      // fires once the buffered output has been read, so it cannot be missed there.
      channel.on('close', (code?: number | null, signalName?: string) => {
        if (exitCode === null && typeof code === 'number') exitCode = code;
        if (signal === null && typeof signalName === 'string') signal = signalName;
        finish();
      });

      if (options.stdin !== undefined && options.stdin.length > 0) channel.end(options.stdin);
      else channel.end();
    });
  }

  /**
   * A command's stdin and stdout as one two-way stream, for long-lived conversations such as the
   * core's `bridge`. Whatever the command writes to stderr is left out of the stream.
   */
  async openExecStream(command: string): Promise<Duplex> {
    this.assertOpen();
    return new Promise((resolve, reject) => {
      this.client.exec(command, (error, channel) => (error ? reject(error) : resolve(channel)));
    });
  }

  /** A byte stream to a Unix socket or TCP port on the server, carried inside this connection. */
  async openStream(target: TunnelTarget): Promise<Duplex> {
    this.assertOpen();
    return new Promise((resolve, reject) => {
      const done = (error: Error | undefined, channel: ClientChannel): void => {
        if (error) {
          reject(
            new TunnelRefusedError(
              `Could not open a tunnel to ${describeTarget(target)} on ${this.endpoint.host}: ` +
                `${error.message}`,
              (error as Error & { reason?: unknown }).reason,
            ),
          );
        } else {
          resolve(channel);
        }
      };
      if ('socketPath' in target)
        this.client.openssh_forwardOutStreamLocal(target.socketPath, done);
      else this.client.forwardOut('127.0.0.1', 0, target.host, target.port, done);
    });
  }

  /**
   * Writes `content` to `remotePath` so that the path either keeps its old contents or holds the
   * complete new file, never a partial one: a temporary name first, fsync, then an atomic rename.
   * SFTP runs as the login user, so the target folder must be one that user can write to.
   */
  async upload(content: Buffer, remotePath: string, options: UploadOptions = {}): Promise<void> {
    const sftp = await this.untilClosed(this.sftp());
    const partial = `${remotePath}.${randomUUID()}.partial`;
    try {
      const handle = await this.untilClosed(
        new Promise<Buffer>((resolve, reject) => {
          sftp.open(partial, 'w', { mode: options.mode ?? 0o600 }, (error, result) =>
            error ? reject(error) : resolve(result),
          );
        }),
      );
      try {
        for (let offset = 0; offset < content.length; offset += UPLOAD_CHUNK_BYTES) {
          const length = Math.min(UPLOAD_CHUNK_BYTES, content.length - offset);
          await this.untilClosed(
            new Promise<void>((resolve, reject) => {
              sftp.write(handle, content, offset, length, offset, (error) =>
                error ? reject(error) : resolve(),
              );
            }),
          );
          options.onProgress?.(offset + length, content.length);
        }
        await this.untilClosed(
          new Promise<void>((resolve, reject) => {
            sftp.ext_openssh_fsync(handle, (error) => (error ? reject(error) : resolve()));
          }),
        );
      } finally {
        if (this.isOpen) {
          await this.untilClosed(
            new Promise<void>((resolve) => sftp.close(handle, () => resolve())),
          ).catch(() => undefined);
        }
      }
      await this.untilClosed(
        new Promise<void>((resolve, reject) => {
          sftp.ext_openssh_rename(partial, remotePath, (error) =>
            error ? reject(error) : resolve(),
          );
        }),
      );
    } catch (error) {
      if (this.isOpen) {
        await this.untilClosed(
          new Promise<void>((resolve) => sftp.unlink(partial, () => resolve())),
        ).catch(() => undefined);
      }
      throw error;
    }
  }

  /**
   * A fresh folder in the server's temp directory, owned by the login user. The answer must look
   * like the folder mktemp was asked for, because callers remove it again with `rm -rf`.
   */
  async createStagingDirectory(): Promise<string> {
    const result = await this.exec('mktemp -d -t agentmate.XXXXXXXXXX', { timeoutMs: 30_000 });
    const path = result.stdout.trim();
    if (result.exitCode !== 0 || !STAGING_DIRECTORY.test(path)) {
      throw new Error(
        `Could not create a staging folder on ${this.endpoint.host}: ${result.stderr.trim()}`,
      );
    }
    return path;
  }

  close(): void {
    if (this.closed) return;
    this.markClosed();
    this.client.end();
  }

  /** Safe to call twice: close() calls it, and so does the 'close' event that follows. */
  private markClosed(): void {
    this.closed = true;
    this.sftpSession = null;
    this.signalClosed(new Error(`The SSH connection to ${this.endpoint.host} closed.`));
  }

  private untilClosed<T>(work: Promise<T>): Promise<T> {
    return Promise.race([work, this.closedSignal]);
  }

  private sftp(): Promise<SFTPWrapper> {
    this.assertOpen();
    this.sftpSession ??= new Promise((resolve, reject) => {
      this.client.sftp((error, session) => (error ? reject(error) : resolve(session)));
    });
    return this.sftpSession;
  }

  private assertOpen(): void {
    if (this.closed) throw new Error(`The SSH connection to ${this.endpoint.host} is closed.`);
  }
}
