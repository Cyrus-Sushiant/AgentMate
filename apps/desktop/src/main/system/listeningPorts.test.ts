import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withPlatform } from '../../test/main/fixtures';

/**
 * The status bar shows which port a project run serves, read from the OS's list of listening
 * sockets. Each platform has its own tool for that; what matters is that the right one is asked,
 * its answer ends up grouped by pid, and a machine without the tool simply shows no ports.
 */

type Answer = { stdout?: string; error?: Error & { stdout?: string } };

const calls = vi.hoisted(() => [] as { command: string; args: string[] }[]);
const answer = vi.hoisted(() => ({ current: {} as Answer }));

vi.mock('node:child_process', () => ({
  execFile: (
    command: string,
    args: string[],
    _options: unknown,
    callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
  ) => {
    calls.push({ command, args });
    const { stdout, error } = answer.current;
    if (error) callback(error);
    else callback(null, { stdout: stdout ?? '', stderr: '' });
  },
}));

// The mock hands its callback one { stdout, stderr } object, which is what promisify resolves to,
// the same shape the real execFile gives.
const { sampleListeningPorts } = await import('./listeningPorts');

beforeEach(() => {
  calls.length = 0;
  answer.current = {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sampleListeningPorts', () => {
  it('asks netstat on Windows and groups the ports by pid, lowest first', async () => {
    answer.current.stdout = [
      '  TCP    0.0.0.0:9229           0.0.0.0:0              LISTENING       4243',
      '  TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       4243',
      '  TCP    [::]:5173              [::]:0                 LISTENING       4243',
      '  TCP    0.0.0.0:80             0.0.0.0:0              LISTENING       7000',
    ].join('\r\n');

    const ports = await withPlatform('win32', () => sampleListeningPorts());

    expect(calls).toEqual([{ command: 'netstat', args: ['-ano'] }]);
    expect(ports).toEqual(
      new Map([
        [4243, [5173, 9229]],
        [7000, [80]],
      ]),
    );
  });

  it('asks lsof on macOS and keeps what it printed even when it exits non-zero', async () => {
    const error = Object.assign(new Error('exit 1'), { stdout: 'p501\nf20\nn*:3000\n' });
    answer.current.error = error;

    const ports = await withPlatform('darwin', () => sampleListeningPorts());

    expect(calls[0]?.command).toBe('lsof');
    expect(ports).toEqual(new Map([[501, [3000]]]));
  });

  it('asks ss on Linux', async () => {
    answer.current.stdout = 'LISTEN 0 511 0.0.0.0:8000 0.0.0.0:* users:(("python",pid=88,fd=3))\n';

    const ports = await withPlatform('linux', () => sampleListeningPorts());

    expect(calls).toEqual([{ command: 'ss', args: ['-ltnpH'] }]);
    expect(ports).toEqual(new Map([[88, [8000]]]));
  });

  it('gives no ports when the tool is missing', async () => {
    answer.current.error = Object.assign(new Error('spawn netstat ENOENT'), {});

    const ports = await withPlatform('win32', () => sampleListeningPorts());

    expect(ports).toEqual(new Map());
  });

  it('shares one reading between callers asking at the same time', async () => {
    answer.current.stdout = '';

    await withPlatform('win32', () =>
      Promise.all([sampleListeningPorts(), sampleListeningPorts()]),
    );

    expect(calls).toHaveLength(1);
  });
});
