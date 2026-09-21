import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Wireless debugging. The host and port are typed by the user and go straight onto an adb command
 * line, so the guard against anything that is not a plain host and port is the point of this file.
 */

const state = vi.hoisted(() => ({
  calls: [] as string[][],
  answers: [] as { match: string; stdout?: string; error?: string }[],
}));

vi.mock('./exec', () => ({
  AndroidCommandError: class extends Error {},
  AndroidToolMissingError: class extends Error {},
  runAdb: (_sdk: unknown, args: string[]) => {
    state.calls.push(args);
    const line = args.join(' ');
    const answer = state.answers.find((a) => line.includes(a.match));
    if (answer?.error) return Promise.reject(new Error(answer.error));
    return Promise.resolve(answer?.stdout ?? '');
  },
}));

const sdk = { paths: { adb: '/sdk/adb' } } as never;

beforeEach(() => {
  state.calls.length = 0;
  state.answers.length = 0;
});

describe('pairDevice', () => {
  it('pairs with the code from the phone', async () => {
    const { pairDevice } = await import('./pairing');
    state.answers.push({ match: 'pair', stdout: 'Successfully paired to 192.168.1.20:37105' });

    const result = await pairDevice(sdk, '192.168.1.20:37105', '123456');

    expect(result.ok).toBe(true);
    expect(state.calls[0]).toEqual(['pair', '192.168.1.20:37105', '123456']);
  });

  it('carries the reason back so the user can retype', async () => {
    const { pairDevice } = await import('./pairing');
    state.answers.push({ match: 'pair', stdout: 'Failed: Wrong password' });

    const result = await pairDevice(sdk, '192.168.1.20:37105', '000000');

    expect(result).toMatchObject({ ok: false, message: 'Wrong password' });
  });

  it('refuses a host that is not a plain host and port, before running adb', async () => {
    const { pairDevice } = await import('./pairing');

    for (const bad of ['192.168.1.20', 'evil host:5555', '--flag:5555', '$(id):5555']) {
      const result = await pairDevice(sdk, bad, '123456');
      expect(result.ok, bad).toBe(false);
    }
    expect(state.calls).toHaveLength(0);
  });

  it('refuses a pairing code that is not six digits', async () => {
    const { pairDevice } = await import('./pairing');

    const result = await pairDevice(sdk, '192.168.1.20:37105', 'abc; rm -rf /');

    expect(result.ok).toBe(false);
    expect(state.calls).toHaveLength(0);
  });
});

describe('connectDevice', () => {
  it('treats an existing connection as success', async () => {
    const { connectDevice } = await import('./pairing');
    state.answers.push({ match: 'connect', stdout: 'already connected to 192.168.1.20:5555' });

    await expect(connectDevice(sdk, '192.168.1.20:5555')).resolves.toMatchObject({ ok: true });
  });

  it('reports a refused connection', async () => {
    const { connectDevice } = await import('./pairing');
    state.answers.push({
      match: 'connect',
      stdout: "failed to connect to '192.168.1.20:5555': Connection refused",
    });

    const result = await connectDevice(sdk, '192.168.1.20:5555');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Connection refused');
  });
});

describe('enableWireless', () => {
  it('switches a USB device over and hands back the address to reconnect to', async () => {
    const { enableWireless } = await import('./pairing');
    state.answers.push({ match: 'tcpip', stdout: 'restarting in TCP mode port: 5555' });
    state.answers.push({
      match: 'ip route',
      stdout: '192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.42\n',
    });
    state.answers.push({ match: 'connect', stdout: 'connected to 192.168.1.42:5555' });

    const result = await enableWireless(sdk, 'R58M20ABCDE');

    expect(result).toMatchObject({ ok: true, hostPort: '192.168.1.42:5555' });
  });

  it('says so when the device has no address on the network', async () => {
    const { enableWireless } = await import('./pairing');
    state.answers.push({ match: 'tcpip', stdout: '' });
    state.answers.push({ match: 'ip route', stdout: '' });

    const result = await enableWireless(sdk, 'R58M20ABCDE');

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Wi-Fi|network/i);
  });
});
