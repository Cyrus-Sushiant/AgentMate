import { readFile } from 'node:fs/promises';
import { connect, type Socket } from 'node:net';
import {
  createLineReader,
  encodeLine,
  type HelloResult,
  type HostMessage,
  type HostRequest,
  PTY_HOST_PROTOCOL_VERSION,
} from './protocol';

export interface HostClientEvents {
  onData(sessionId: string, data: string): void;
  onExit(sessionId: string, exitCode: number): void;
  /** The connection dropped without close() being called (the host died or was killed). */
  onDisconnect(): void;
}

const REQUEST_TIMEOUT_MS = 10_000;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/** One authenticated connection from the app to the terminal host. */
export class HostClient {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private closedByUs = false;
  private events: HostClientEvents | null = null;

  private constructor(private readonly socket: Socket) {
    const read = createLineReader(
      (message) => this.dispatch(message as HostMessage),
      () => socket.destroy(),
    );
    socket.setNoDelay(true);
    socket.on('data', read);
    socket.on('error', () => undefined);
    socket.on('close', () => {
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new Error('terminal host connection closed'));
      }
      this.pending.clear();
      if (!this.closedByUs) this.events?.onDisconnect();
    });
  }

  /** Connects and says hello. Rejects if nothing is listening or the token is wrong. */
  static async connect(
    endpoint: string,
    tokenFile: string,
  ): Promise<{ client: HostClient; hello: HelloResult }> {
    const token = (await readFile(tokenFile, 'utf8')).trim();
    const socket = await new Promise<Socket>((resolve, reject) => {
      const candidate = connect(endpoint);
      const timer = setTimeout(() => {
        candidate.destroy();
        reject(new Error('timed out connecting to terminal host'));
      }, 3000);
      candidate.once('connect', () => {
        clearTimeout(timer);
        candidate.removeListener('error', reject);
        resolve(candidate);
      });
      candidate.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const client = new HostClient(socket);
    try {
      const hello = await client.request<HelloResult>(
        { type: 'hello', token, protocolVersion: PTY_HOST_PROTOCOL_VERSION },
        3000,
      );
      return { client, hello };
    } catch (error) {
      client.close();
      throw error;
    }
  }

  setEvents(events: HostClientEvents): void {
    this.events = events;
  }

  get connected(): boolean {
    return !this.socket.destroyed;
  }

  request<T>(message: HostRequest, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
    if (this.socket.destroyed) {
      return Promise.reject(new Error('terminal host is not connected'));
    }
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`terminal host did not answer ${message.type}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      this.socket.write(encodeLine({ ...message, id }));
    });
  }

  /** Fire-and-forget, for keystrokes and resizes where waiting on a reply only adds lag. */
  notify(message: HostRequest): void {
    if (!this.socket.destroyed) this.socket.write(encodeLine(message));
  }

  /** Drops the connection. The host keeps every shell running. */
  close(): void {
    this.closedByUs = true;
    this.socket.destroy();
  }

  /** Waits until everything written so far has been handed to the OS, then disconnects. */
  closeAfterFlush(): Promise<void> {
    this.closedByUs = true;
    return new Promise((resolve) => {
      if (this.socket.destroyed) {
        resolve();
        return;
      }
      this.socket.once('close', () => resolve());
      this.socket.end();
      setTimeout(() => {
        this.socket.destroy();
        resolve();
      }, 1000).unref();
    });
  }

  private dispatch(message: HostMessage): void {
    if (message.kind === 'response') {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.ok) entry.resolve(message.result);
      else entry.reject(new Error(message.error));
      return;
    }
    if (message.event === 'data') this.events?.onData(message.sessionId, message.data);
    else this.events?.onExit(message.sessionId, message.exitCode);
  }
}
