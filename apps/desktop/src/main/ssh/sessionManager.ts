import { readFile } from 'node:fs/promises';
import { StringDecoder } from 'node:string_decoder';
import { Client, type ClientChannel } from 'ssh2';
import type { SshAuthMethod } from '../../shared/apiTypes';

export interface SshConnectOptions {
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  /** Previously trusted host key fingerprint (SHA256, hex), if any. */
  storedFingerprint?: string;
  cols?: number;
  rows?: number;
}

export interface SshSessionListener {
  onData: (sessionId: string, data: string) => void;
  onExit: (sessionId: string, error?: string) => void;
  /** Fires once, the first time this server is ever connected to, so the caller can persist it. */
  onHostKeyTrusted: (sessionId: string, fingerprint: string) => void;
}

interface Session {
  client: Client;
  stream: ClientChannel;
}

/** Turns an ssh2 connect failure into something a user, not a protocol log, can read. */
function friendlyConnectError(
  error: NodeJS.ErrnoException & { level?: string },
  host: string,
  port: number,
  hostKeyMismatch: boolean,
): Error {
  if (hostKeyMismatch) {
    return new Error(
      `Host key for ${host}:${port} has changed since you last connected. If you did not ` +
        'reinstall or replace this server, treat this as a possible security warning. Edit ' +
        'and save the server to trust the new key.',
    );
  }
  if (error.level === 'client-authentication') {
    return new Error('Authentication failed. Check the username, password, or private key.');
  }
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return new Error(`Could not reach ${host}:${port}.`);
  }
  if (error.code === 'ETIMEDOUT') {
    return new Error(`Connection to ${host}:${port} timed out.`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

export class SshSessionManager {
  private sessions = new Map<string, Session>();

  /** Idempotent: a session id already open is left alone rather than opening a second socket. */
  async create(
    sessionId: string,
    options: SshConnectOptions,
    listener: SshSessionListener,
  ): Promise<void> {
    if (this.sessions.has(sessionId)) return;

    let privateKey: Buffer | undefined;
    if (options.authMethod === 'privateKey' && options.privateKeyPath) {
      privateKey = await readFile(options.privateKeyPath);
    }

    let trustedFingerprint: string | null = null;
    let hostKeyMismatch = false;
    const client = new Client();

    try {
      await new Promise<void>((resolve, reject) => {
        client
          .on('ready', () => {
            if (trustedFingerprint) listener.onHostKeyTrusted(sessionId, trustedFingerprint);
            client.shell(
              { cols: options.cols, rows: options.rows, term: 'xterm-256color' },
              (err, stream) => {
                if (err) {
                  reject(err);
                  return;
                }
                this.sessions.set(sessionId, { client, stream });
                // A chunk can end partway through a multi-byte character (box drawing, the
                // symbols agent CLIs draw with). Decoding each chunk on its own turned both
                // halves into replacement characters; a decoder carries the tail over instead.
                const stdout = new StringDecoder('utf8');
                const stderr = new StringDecoder('utf8');
                stream.on('data', (chunk: Buffer) => {
                  const text = stdout.write(chunk);
                  if (text) listener.onData(sessionId, text);
                });
                stream.stderr.on('data', (chunk: Buffer) => {
                  const text = stderr.write(chunk);
                  if (text) listener.onData(sessionId, text);
                });
                stream.on('close', () => {
                  this.sessions.delete(sessionId);
                  client.end();
                  listener.onExit(sessionId);
                });
                resolve();
              },
            );
          })
          .on('error', (err) => {
            reject(friendlyConnectError(err, options.host, options.port, hostKeyMismatch));
          })
          .connect({
            host: options.host,
            port: options.port,
            username: options.username,
            password: options.authMethod === 'password' ? options.password : undefined,
            privateKey,
            passphrase: options.authMethod === 'privateKey' ? options.passphrase : undefined,
            readyTimeout: 15000,
            hostHash: 'sha256',
            hostVerifier: (fingerprint: string): boolean => {
              if (!options.storedFingerprint) {
                trustedFingerprint = fingerprint;
                return true;
              }
              if (fingerprint === options.storedFingerprint) return true;
              hostKeyMismatch = true;
              return false;
            },
          });
      });
    } catch (error) {
      this.sessions.delete(sessionId);
      client.end();
      throw error;
    }
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.stream.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.sessions.get(sessionId)?.stream.setWindow(rows, cols, 0, 0);
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    session.stream.end();
    session.client.end();
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id);
  }
}
