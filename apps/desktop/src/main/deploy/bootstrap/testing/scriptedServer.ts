import { Duplex } from 'node:stream';
import type { SshEndpoint } from '../../../ssh/connectConfig';
import type { ExecOptions, ExecResult, UploadOptions } from '../../../ssh/connection';
import { TunnelRefusedError } from '../../../ssh/connection';

/**
 * A server as a script: it answers the preflight's probes and the installer's root commands the
 * way a real Ubuntu or Rocky machine would, and records everything, so installer tests read like
 * a transcript. Root commands can be made to fail to test checksum and start failures.
 */

export interface ScriptedMachine {
  osRelease: string;
  machine: string;
  uid: number;
  sudo: 'passwordless' | 'password';
  sudoPassword: string;
  streamLocal: boolean;
  installed: { release: string; version: string } | null;
  selinux: 'Enforcing' | null;
  /** Root commands (matched by substring) that should fail, with what they print. */
  failures: Array<{ match: string; stderr: string; exitCode?: number }>;
}

export const UBUNTU_24 =
  'NAME="Ubuntu"\nVERSION_ID="24.04"\nID=ubuntu\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\n';

export function scriptedMachine(overrides: Partial<ScriptedMachine> = {}): ScriptedMachine {
  return {
    osRelease: UBUNTU_24,
    machine: 'x86_64',
    uid: 1000,
    sudo: 'password',
    sudoPassword: 'deployer-pw',
    streamLocal: true,
    installed: null,
    selinux: null,
    failures: [],
    ...overrides,
  };
}

function done(stdout = '', exitCode = 0, stderr = ''): ExecResult {
  return { stdout, stderr, exitCode, signal: null, timedOut: false };
}

/** Undoes the `sh -c '<command>'` quoting the root shell adds. */
function unquote(quoted: string): string {
  if (!quoted.startsWith("'")) return quoted;
  return quoted.slice(1, -1).replace(/'\\''/g, "'");
}

export class ScriptedConnection {
  readonly endpoint: SshEndpoint;
  readonly commands: string[] = [];
  readonly rootCommands: string[] = [];
  readonly uploads: Array<{ path: string; bytes: number; mode?: number }> = [];
  readonly tunnels: string[] = [];
  readonly execStreams: string[] = [];

  constructor(readonly machine: ScriptedMachine) {
    this.endpoint = {
      host: 'prod.example',
      port: 22,
      username: machine.uid === 0 ? 'root' : 'deployer',
      authMethod: 'password',
      password: machine.sudoPassword,
    };
  }

  async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    this.commands.push(command);
    const stdin = options.stdin === undefined ? '' : String(options.stdin);
    const m = this.machine;

    if (command === 'cat /etc/os-release') return done(m.osRelease);
    if (command === 'uname -m') return done(`${m.machine}\n`);
    if (command.startsWith('test -d /run/systemd/system')) return done('yes\n');
    if (command.startsWith('df -Pk')) return done('20000000\n20000000\n');
    if (command === 'id -u') return done(`${m.uid}\n`);
    if (command === 'sudo -k -n true') return done('', m.sudo === 'passwordless' ? 0 : 1);
    if (command.startsWith('readlink -f /opt/agentmate-core/current')) {
      return m.installed ? done(`${m.installed.release}\n`) : done('', 1);
    }
    if (command.includes('admin version')) {
      return m.installed ? done(JSON.stringify({ version: m.installed.version })) : done('', 127);
    }
    if (command.includes('getenforce')) return done(`${m.selinux ?? 'absent'}\n`);
    if (command.startsWith('mktemp -d')) return done('/tmp/agentmate.Test123456\n');
    if (command.startsWith('rm -rf /tmp/agentmate.')) return done();

    if (command === "sudo -S -k -p '' true") {
      return stdin.split('\n')[0] === m.sudoPassword ? done() : done('', 1, 'Sorry, try again.\n');
    }
    let unwrapped: string | null = null;
    const sudoWrapped = /^sudo (?:-S -k -p '' |-n )-- sh -c (.+)$/s.exec(command);
    if (sudoWrapped) {
      if (command.startsWith('sudo -S') && stdin.split('\n')[0] !== m.sudoPassword) {
        return done('', 1, 'Sorry, try again.\n');
      }
      unwrapped = unquote(sudoWrapped[1]);
    } else if (m.uid === 0) {
      unwrapped = command;
    }
    if (unwrapped === null) return done('', 127, `unexpected command: ${command}`);
    const root = unwrapped;

    this.rootCommands.push(root);
    const failure = m.failures.find((candidate) => root.includes(candidate.match));
    if (failure) return done('', failure.exitCode ?? 1, failure.stderr);
    if (root.startsWith('journalctl')) return done('agentmate-core: Unhandled exception. Boom.\n');
    return done();
  }

  async upload(content: Buffer, remotePath: string, options: UploadOptions = {}): Promise<void> {
    this.uploads.push({ path: remotePath, bytes: content.length, mode: options.mode });
    options.onProgress?.(content.length, content.length);
  }

  async createStagingDirectory(): Promise<string> {
    return '/tmp/agentmate.Test123456';
  }

  async openStream(
    target: { socketPath: string } | { host: string; port: number },
  ): Promise<Duplex> {
    const path = 'socketPath' in target ? target.socketPath : `${target.host}:${target.port}`;
    this.tunnels.push(path);
    if (!this.machine.streamLocal) throw new TunnelRefusedError(`refused ${path}`, 1);
    throw new TunnelRefusedError(`nothing at ${path}`, 2);
  }

  async openExecStream(command: string): Promise<Duplex> {
    this.execStreams.push(command);
    return new Duplex({
      read: () => undefined,
      write: (_chunk, _encoding, callback) => callback(),
    });
  }
}
