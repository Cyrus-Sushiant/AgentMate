import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SshAgentProgress } from '../../shared/apiTypes';
import { IPC } from '../../shared/ipcChannels';
import { registerSshHandlers } from '../ipc/ssh';
import { answerSshTaskPassword, startSshTask, stopSshTask } from './sshTaskRunner';
import { createTerminalScreen, type TerminalScreen } from './testing/terminalScreen';

/**
 * The runner against the real ssh.ts, with a scripted bash on the far end of the channel and a
 * scripted AI. The screen is what the terminal pane would draw from what ssh.ts sends it.
 */

const PASSWORD = 's3cret-pw';
const PROMPT = 'smartvpn@smartvpn:~$ ';

const fake = vi.hoisted(() => {
  type Io = { print: (text: string) => void; askPassword: (prompt: string) => Promise<string> };
  type Handler = (io: Io, shell: FakeBash) => Promise<number> | number;

  /**
   * Enough of bash over SSH for the runner: it echoes what is typed (with the space and carriage
   * return readline adds where a long line wraps), runs the command between AgentMate's markers,
   * and hands output back in small uneven chunks the way a network read does.
   */
  class FakeBash {
    readonly written: string[] = [];
    readonly ran: string[] = [];
    sudoAuthed = false;
    private line = '';
    private passwordWaiter: ((value: string) => void) | null = null;

    constructor(
      private readonly send: (chunk: string) => void,
      private readonly enter: string,
      private readonly handlers: Record<string, Handler>,
      private readonly afterPrompt = '',
    ) {}

    emit(text: string): void {
      const sizes = [3, 11, 5, 17, 2, 29];
      let i = 0;
      let n = 0;
      while (i < text.length) {
        const size = sizes[n % sizes.length];
        this.send(text.slice(i, i + size));
        i += size;
        n += 1;
      }
    }

    prompt(): void {
      this.emit(`${this.afterPrompt}\x1b[?2004h${PROMPT}`);
    }

    write(data: string): void {
      this.written.push(data);
      for (const char of data) {
        if (char !== this.enter) {
          this.line += char;
          continue;
        }
        const line = this.line;
        this.line = '';
        if (this.passwordWaiter) {
          const resolve = this.passwordWaiter;
          this.passwordWaiter = null;
          this.emit('\r\n');
          resolve(line);
        } else {
          void this.run(line);
        }
      }
    }

    private async run(line: string): Promise<void> {
      const wrapped = line.replace(/(.{60})/g, '$1 \r');
      this.emit(`${wrapped}\r\n\x1b[?2004l\r`);
      const hidden = line.match(
        /^printf '\\033\]7750;AgentMate:Start:(\w+)\\007'; (.*); printf '\\033\]7750;AgentMate:Done:\1:%s\\007' "\$\?"$/,
      );
      const plain = line.match(/^(.*); printf '\\n(__AGENTMATE_DONE_\w+__):%s\\n' "\$\?"$/);
      const body = hidden?.[2] ?? plain?.[1] ?? line;
      if (hidden) this.emit(`\x1b]7750;AgentMate:Start:${hidden[1]}\x07`);
      this.ran.push(body);
      const handler = this.handlers[body];
      const code = handler
        ? await handler(
            {
              print: (text) => this.emit(text),
              askPassword: (prompt) =>
                new Promise((resolve) => {
                  this.passwordWaiter = resolve;
                  this.emit(prompt);
                }),
            },
            this,
          )
        : (this.emit(`bash: ${body.split(' ')[0]}: command not found\r\n`), 127);
      if (hidden) this.emit(`\x1b]7750;AgentMate:Done:${hidden[1]}:${code}\x07`);
      if (plain) this.emit(`\n${plain[2]}:${code}\n`);
      this.prompt();
    }
  }

  return {
    FakeBash,
    shells: new Map<string, FakeBash>(),
    aiReplies: [] as string[],
    aiPrompts: [] as string[],
    handlers: {} as Record<string, Handler>,
    gate: null as null | Promise<void>,
    local: {
      captured: false,
      screen: null as null | ((data: string) => void),
      outputListeners: new Set<(data: string) => void>(),
      shell: null as null | FakeBash,
    },
  };
});

vi.mock('electron', () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    ipcMain: {
      handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn),
    },
    dialog: {},
    __handlers: handlers,
  };
});
vi.mock('../power/keepAwake', () => ({ keepAwake: { setBusy: vi.fn() } }));
vi.mock('../ssh/vault', () => ({
  decryptSecret: vi.fn(async () => PASSWORD),
  encryptSecret: vi.fn(),
  getVaultStatus: vi.fn(),
  setPasskey: vi.fn(),
  unlockVault: vi.fn(),
}));
vi.mock('../ssh/sessionManager', () => ({
  SshSessionManager: class {
    async create(
      sessionId: string,
      _options: unknown,
      listener: { onData: (id: string, data: string) => void },
    ): Promise<void> {
      const shell = new fake.FakeBash(
        (chunk) => listener.onData(sessionId, chunk),
        '\n',
        fake.handlers,
      );
      fake.shells.set(sessionId, shell);
      shell.prompt();
    }
    write(sessionId: string, data: string): void {
      fake.shells.get(sessionId)?.write(data);
    }
    resize = vi.fn();
    kill = vi.fn();
    killAll = vi.fn();
  },
}));
vi.mock('../store', () => ({
  store: {
    getSshServers: vi.fn(async () => [
      {
        id: 'server-1',
        nickname: 'SmartClouds',
        host: 'example.test',
        port: 22,
        username: 'smartvpn',
        authMethod: 'password',
        secretEnvelope: { mode: 'safeStorage', ciphertext: 'x' },
        createdAt: 0,
        lastConnectedAt: null,
      },
    ]),
    setSshServers: vi.fn(async () => undefined),
    getSettings: vi.fn(async () => ({
      promptBuilderProvider: 'openai',
      openaiModel: 'test-model',
    })),
  },
}));
vi.mock('../ipc/ai', () => ({
  runAiPrompt: vi.fn(async (_provider: string, _model: string, prompt: string) => {
    fake.aiPrompts.push(prompt);
    return fake.aiReplies.shift() ?? 'FINISHED: out of script';
  }),
}));
vi.mock('../cli/headlessPrompt', () => ({
  cancelHeadlessPrompt: vi.fn(),
  runHeadlessCliPrompt: vi.fn(),
}));
vi.mock('../notifications/petNotifier', () => ({ speakOnPet: vi.fn() }));
vi.mock('@agentmat/core', () => ({
  runChoiceArgs: vi.fn(() => []),
  runProfileForTargetAI: vi.fn(),
}));
vi.mock('../ipc/terminal', () => ({
  hasAttachedTerminalSession: () => true,
  terminalSessionShell: () => 'bash',
  writeToSession: (_id: string, data: string) => fake.local.shell?.write(data),
  subscribeTerminalOutput: (_id: string, listener: (data: string) => void) => {
    fake.local.outputListeners.add(listener);
    return () => fake.local.outputListeners.delete(listener);
  },
  subscribeTerminalExit: () => () => undefined,
  setTerminalDisplayCaptured: (_id: string, captured: boolean) => {
    fake.local.captured = captured;
  },
  writeToTerminalDisplay: (_id: string, data: string) => fake.local.screen?.(data),
}));

const standardHandlers: typeof fake.handlers = {
  'cat /etc/os-release': ({ print }) => {
    print('PRETTY_NAME="Ubuntu 22.04.4 LTS"\r\nUBUNTU_CODENAME=jammy\r\n');
    return 0;
  },
  'sudo -n apt-get update': ({ print }, shell) => {
    if (shell.sudoAuthed) return 0;
    print('sudo: a password is required\r\n');
    return 1;
  },
  'sudo apt-get update': async ({ print, askPassword }, shell) => {
    if (!shell.sudoAuthed) {
      const typed = await askPassword('[sudo] password for smartvpn: ');
      if (typed !== PASSWORD) {
        print('Sorry, try again.\r\n');
        return 1;
      }
      shell.sudoAuthed = true;
    }
    print(
      'Hit:1 http://archive.ubuntu.com/ubuntu jammy InRelease\r\nReading package lists... Done\r\n',
    );
    return 0;
  },
  'ls /nope': ({ print }) => {
    print("ls: cannot access '/nope': No such file or directory\r\n");
    return 2;
  },
  'echo slow start && sleep 5 && echo slow end': async ({ print }) => {
    print('slow start\r\n');
    await fake.gate;
    print('slow end\r\n');
    return 0;
  },
  'echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa':
    ({ print }) => {
      print(`${'a'.repeat(100)}\r\n`);
      return 0;
    },
};

let handlers: Map<string, (...args: unknown[]) => unknown>;
let sessionCounter = 0;
const screens: TerminalScreen[] = [];

beforeAll(async () => {
  registerSshHandlers();
  handlers = ((await import('electron')) as unknown as { __handlers: typeof handlers }).__handlers;
});

afterEach(() => {
  for (const screen of screens.splice(0)) screen.dispose();
  fake.aiReplies.length = 0;
  fake.aiPrompts.length = 0;
});

/** Opens an SSH tab whose output is drawn on a headless terminal, like the renderer does. */
async function openSshTab(): Promise<{ sessionId: string; screen: TerminalScreen }> {
  sessionCounter += 1;
  const sessionId = `session-${sessionCounter}`;
  const screen = createTerminalScreen(80, 40);
  screens.push(screen);
  const sender = {
    isDestroyed: () => false,
    send: (channel: string, payload: { data: string }) => {
      if (channel === IPC.ssh.onData) screen.write(payload.data);
    },
  };
  Object.assign(fake.handlers, standardHandlers);
  await handlers.get(IPC.ssh.create)?.(
    { sender },
    { sessionId, savedServerId: 'server-1', cols: 80, rows: 40 },
  );
  return { sessionId, screen };
}

function startTask(
  sessionId: string,
  replies: string[],
  onProgress: (progress: SshAgentProgress) => void = () => undefined,
  target: 'ssh' | 'local' = 'ssh',
): SshAgentProgress[] {
  fake.aiReplies.push(...replies);
  const progress: SshAgentProgress[] = [];
  startSshTask({ sessionId, prompt: 'update the server', mode: 'autonomous', target }, (p) => {
    progress.push(p);
    onProgress(p);
  });
  return progress;
}

async function waitForPhase(progress: SshAgentProgress[], phase: SshAgentProgress['phase']) {
  await vi.waitFor(() => expect(progress.map((p) => p.phase)).toContain(phase), {
    timeout: 5000,
  });
}

describe('AI task over SSH', () => {
  it('shows each command as typed, with its output and no marker text', async () => {
    const { sessionId, screen } = await openSshTab();
    const progress = startTask(sessionId, [
      'RUN: cat /etc/os-release',
      'RUN: ls /nope',
      'FINISHED: Checked the OS.',
    ]);
    await waitForPhase(progress, 'finished');

    expect(await screen.text()).toBe(
      [
        `${PROMPT}cat /etc/os-release`,
        'PRETTY_NAME="Ubuntu 22.04.4 LTS"',
        'UBUNTU_CODENAME=jammy',
        `${PROMPT}ls /nope`,
        "ls: cannot access '/nope': No such file or directory",
        PROMPT.trimEnd(),
      ].join('\n'),
    );
  });

  it('gives the AI each command with its output and exit code, without the wrapper', async () => {
    const { sessionId } = await openSshTab();
    const progress = startTask(sessionId, [
      'RUN: cat /etc/os-release',
      'RUN: ls /nope',
      'FINISHED: done',
    ]);
    await waitForPhase(progress, 'finished');

    const last = fake.aiPrompts[2];
    expect(last).toContain('$ cat /etc/os-release [exit code 0]\nPRETTY_NAME="Ubuntu 22.04.4 LTS"');
    expect(last).toContain("$ ls /nope [exit code 2]\nls: cannot access '/nope'");
    expect(last).not.toContain('printf');
    expect(last).not.toContain('AgentMate:');
  });

  it('keeps a command that wraps past the terminal width readable', async () => {
    const { sessionId, screen } = await openSshTab();
    const command = `echo ${'a'.repeat(100)}`;
    const progress = startTask(sessionId, [`RUN: ${command}`, 'FINISHED: ok']);
    await waitForPhase(progress, 'finished');

    const text = await screen.text();
    expect(text).toBe([`${PROMPT}${command}`, 'a'.repeat(100), PROMPT.trimEnd()].join('\n'));
  });

  it('shows output live, before the command finishes', async () => {
    const { sessionId, screen } = await openSshTab();
    let open = () => undefined as void;
    fake.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const progress = startTask(sessionId, [
      'RUN: echo slow start && sleep 5 && echo slow end',
      'FINISHED: ok',
    ]);

    await vi.waitFor(async () => expect(await screen.text()).toContain('slow start'), {
      timeout: 5000,
    });
    expect(progress.at(-1)?.phase).toBe('running');
    expect(await screen.text()).not.toMatch(/^slow end$/m);

    open();
    await waitForPhase(progress, 'finished');
    expect(await screen.text()).toContain('slow start\nslow end');
  });

  it('turns sudo -n into a sudo password prompt and types the saved password once approved', async () => {
    const { sessionId, screen } = await openSshTab();
    const progress = startTask(
      sessionId,
      ['RUN: sudo -n apt-get update', 'FINISHED: Updated package lists.'],
      (p) => {
        if (p.phase === 'needs-password') answerSshTaskPassword(sessionId, true);
      },
    );
    await waitForPhase(progress, 'finished');

    const shell = fake.shells.get(sessionId);
    expect(shell?.ran).toEqual(['sudo apt-get update']);
    expect(shell?.written).toContain(`${PASSWORD}\n`);

    const asked = progress.find((p) => p.phase === 'needs-password');
    expect(asked).toMatchObject({ hasSavedPassword: true, command: 'sudo apt-get update' });
    expect(JSON.stringify(progress)).not.toContain(PASSWORD);
    expect(fake.aiPrompts.join('\n')).not.toContain(PASSWORD);

    const text = await screen.text();
    expect(text).toContain(`${PROMPT}sudo apt-get update\n[sudo] password for smartvpn:`);
    expect(text).toContain('Reading package lists... Done');
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain('AGENTMATE');
  });

  it('tells the AI to use plain sudo and never to ask for a password', async () => {
    const { sessionId } = await openSshTab();
    const progress = startTask(sessionId, ['FINISHED: nothing to do']);
    await waitForPhase(progress, 'finished');
    expect(fake.aiPrompts[0]).toContain('use plain sudo. Never pass sudo -n or -S');
    expect(fake.aiPrompts[0]).toContain('never use NEEDS_INPUT to ask for a password');
  });

  it('leaves the prompt to the user when they choose to type the password', async () => {
    const { sessionId, screen } = await openSshTab();
    const progress = startTask(sessionId, ['RUN: sudo apt-get update', 'FINISHED: ok'], (p) => {
      if (p.phase === 'needs-password') answerSshTaskPassword(sessionId, false);
    });
    await vi.waitFor(() => expect(progress.filter((p) => p.phase === 'running')).toHaveLength(2));
    const shell = fake.shells.get(sessionId);
    expect(shell?.written.some((w) => w.includes(PASSWORD))).toBe(false);

    // The user types it into the terminal themselves.
    await handlers.get(IPC.ssh.write)?.({}, sessionId, `${PASSWORD}\n`);
    await waitForPhase(progress, 'finished');
    expect(await screen.text()).toContain('Reading package lists... Done');
  });

  it('hands the terminal back when the run is stopped mid-command', async () => {
    const { sessionId, screen } = await openSshTab();
    let open = () => undefined as void;
    fake.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const progress = startTask(sessionId, ['RUN: echo slow start && sleep 5 && echo slow end']);
    await vi.waitFor(async () => expect(await screen.text()).toContain('slow start'));
    stopSshTask(sessionId);
    expect(progress.at(-1)?.phase).toBe('stopped');

    open();
    await vi.waitFor(async () => expect(await screen.text()).toMatch(/^slow end\n.*\$$/m));
    // Typing afterwards shows up like normal.
    fake.shells.get(sessionId)?.emit('whoami');
    await vi.waitFor(async () => expect(await screen.text()).toMatch(/\$ whoami$/));
  });
});

describe('AI task in a local terminal', () => {
  async function openLocalTab(): Promise<{
    screen: TerminalScreen;
    shell: InstanceType<typeof fake.FakeBash>;
  }> {
    const screen = createTerminalScreen(80, 40);
    screens.push(screen);
    fake.local.screen = (data) => screen.write(data);
    const shell = new fake.FakeBash(
      (chunk) => {
        if (!fake.local.captured) screen.write(chunk);
        for (const listener of fake.local.outputListeners) listener(chunk);
      },
      '\r',
      standardHandlers,
      '\x1b]7750;AgentMate:PromptReady:1\x07',
    );
    fake.local.shell = shell;
    shell.prompt();
    return { screen, shell };
  }

  const realPlatform = process.platform;
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  it('hides the markers on macOS and Linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const { screen, shell } = await openLocalTab();
    const progress = startTask(
      'local-1',
      ['RUN: cat /etc/os-release', 'FINISHED: ok'],
      undefined,
      'local',
    );
    await waitForPhase(progress, 'finished');

    expect(shell.written[0]).toMatch(/^printf '\\033\]7750;AgentMate:Start:/);
    const text = await screen.text();
    expect(text).toContain(`${PROMPT}cat /etc/os-release\nPRETTY_NAME=`);
    expect(text).not.toContain('printf');
  });

  it('keeps plain-text markers on Windows, where ConPTY reorders escape sequences', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const { shell } = await openLocalTab();
    const progress = startTask('local-2', ['RUN: ls /nope', 'FINISHED: ok'], undefined, 'local');
    await waitForPhase(progress, 'finished');

    expect(shell.written[0]).toMatch(
      /^ls \/nope; printf '\\n__AGENTMATE_DONE_\w+__:%s\\n' "\$\?"\r$/,
    );
    expect(fake.aiPrompts[1]).toContain('$ ls /nope [exit code 2]');
  });
});
