import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipcChannels';
import type { DeploySecurity } from '../deploy/security';
import type { DeployService } from '../deploy/service';
import { registerDeploySecurityHandlers } from './deploySecurity';

/**
 * The Security channels answer only the app's main window, like the rest of Deploy, and check
 * every argument before the core is asked: ids are GUIDs, roles one of four, passwords bounded,
 * and the audit filter only what the core understands.
 */

type Listener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const USER = '11111111-2222-4333-8444-555555555555';
const PASSWORD = 'another long passphrase';

function harness(trusted = true) {
  const handlers = new Map<string, Listener>();
  const security = {
    listUsers: vi.fn(async () => []),
    createUser: vi.fn(async () => ({})),
    setUserRole: vi.fn(async () => ({})),
    setUserDisabled: vi.fn(async () => ({})),
    resetUserPassword: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => undefined),
    createEnrollmentCode: vi.fn(async () => ({})),
    listDevices: vi.fn(async () => []),
    revokeDevice: vi.fn(async () => undefined),
    listSessions: vi.fn(async () => []),
    revokeSession: vi.fn(async () => undefined),
    revokeOtherSessions: vi.fn(async () => 0),
    queryAudit: vi.fn(async () => ({ events: [] })),
    verifyAudit: vi.fn(async () => ({ intact: true, checked: 0 })),
    exportAudit: vi.fn(async () => ({ saved: false })),
  };
  const service = { redeemEnrollmentCode: vi.fn(async () => ({ state: 'signed-in' })) };
  registerDeploySecurityHandlers({
    ipc: { handle: (channel, listener) => handlers.set(channel, listener) },
    security: security as unknown as DeploySecurity,
    service: service as unknown as DeployService,
    guard: () => trusted,
  });
  const call = (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler({} as IpcMainInvokeEvent, ...args);
  };
  return { security, service, call, handlers };
}

describe('registerDeploySecurityHandlers', () => {
  it('handles every channel in the group', () => {
    const { handlers } = harness();

    expect([...handlers.keys()].sort()).toEqual(Object.values(IPC.deploySecurity).sort());
  });

  it('answers only the main window', async () => {
    const { security, call } = harness(false);

    await expect(call(IPC.deploySecurity.listUsers, 'srv-1')).rejects.toThrow(/main window/);
    expect(security.listUsers).not.toHaveBeenCalled();
  });

  it('passes user changes through once their arguments check out', async () => {
    const { security, call } = harness();

    await call(IPC.deploySecurity.listUsers, 'srv-1');
    await call(IPC.deploySecurity.createUser, {
      serverId: 'srv-1',
      userName: 'sam',
      password: PASSWORD,
      role: 'operator',
    });
    await call(IPC.deploySecurity.setUserRole, { serverId: 'srv-1', userId: USER, role: 'admin' });
    await call(IPC.deploySecurity.setUserDisabled, {
      serverId: 'srv-1',
      userId: USER,
      disabled: true,
    });
    await call(IPC.deploySecurity.resetUserPassword, {
      serverId: 'srv-1',
      userId: USER,
      password: PASSWORD,
    });
    await call(IPC.deploySecurity.deleteUser, { serverId: 'srv-1', userId: USER });
    await call(IPC.deploySecurity.createEnrollmentCode, {
      serverId: 'srv-1',
      userName: 'sam',
      validMinutes: 60,
    });
    await call(IPC.deploySecurity.createEnrollmentCode, { serverId: 'srv-1' });

    expect(security.listUsers).toHaveBeenCalledWith('srv-1');
    expect(security.createUser).toHaveBeenCalledWith({
      serverId: 'srv-1',
      userName: 'sam',
      password: PASSWORD,
      role: 'operator',
    });
    expect(security.setUserRole).toHaveBeenCalledWith({
      serverId: 'srv-1',
      userId: USER,
      role: 'admin',
    });
    expect(security.setUserDisabled).toHaveBeenCalledWith({
      serverId: 'srv-1',
      userId: USER,
      disabled: true,
    });
    expect(security.resetUserPassword).toHaveBeenCalledWith({
      serverId: 'srv-1',
      userId: USER,
      password: PASSWORD,
    });
    expect(security.deleteUser).toHaveBeenCalledWith({ serverId: 'srv-1', userId: USER });
    expect(security.createEnrollmentCode).toHaveBeenNthCalledWith(1, {
      serverId: 'srv-1',
      userName: 'sam',
      validMinutes: 60,
    });
    expect(security.createEnrollmentCode).toHaveBeenNthCalledWith(2, { serverId: 'srv-1' });
  });

  it('refuses user arguments of the wrong shape before the core sees them', async () => {
    const { security, call } = harness();

    const bad: Array<[string, unknown]> = [
      [IPC.deploySecurity.listUsers, '../etc'],
      [
        IPC.deploySecurity.createUser,
        { serverId: 'srv-1', userName: 'sam;rm', password: PASSWORD, role: 'operator' },
      ],
      [
        IPC.deploySecurity.createUser,
        { serverId: 'srv-1', userName: 'sam', password: PASSWORD, role: 'superuser' },
      ],
      [
        IPC.deploySecurity.createUser,
        { serverId: 'srv-1', userName: 'sam', password: 'x'.repeat(2000), role: 'viewer' },
      ],
      [IPC.deploySecurity.setUserRole, { serverId: 'srv-1', userId: 'not-a-guid', role: 'admin' }],
      [IPC.deploySecurity.setUserDisabled, { serverId: 'srv-1', userId: USER, disabled: 'yes' }],
      [IPC.deploySecurity.resetUserPassword, { serverId: 'srv-1', userId: USER, password: '' }],
      [IPC.deploySecurity.deleteUser, { serverId: 'srv-1' }],
      [IPC.deploySecurity.createEnrollmentCode, { serverId: 'srv-1', validMinutes: 0 }],
      [IPC.deploySecurity.createEnrollmentCode, { serverId: 'srv-1', validMinutes: 1.5 }],
      [IPC.deploySecurity.createEnrollmentCode, null],
    ];
    for (const [channel, input] of bad) {
      await expect(call(channel, input), `${channel} ${JSON.stringify(input)}`).rejects.toThrow();
    }
    for (const fn of Object.values(security)) expect(fn).not.toHaveBeenCalled();
  });

  it('redeems a code on this computer, with the code checked for what a code can hold', async () => {
    const { service, call } = harness();
    const input = {
      serverId: 'srv-1',
      code: 'abcde-fghij klmnp',
      userName: 'sam',
      password: PASSWORD,
    };

    await call(IPC.deploySecurity.redeemEnrollmentCode, input);
    await expect(
      call(IPC.deploySecurity.redeemEnrollmentCode, { ...input, code: '<script>' }),
    ).rejects.toThrow(/code/);
    await expect(
      call(IPC.deploySecurity.redeemEnrollmentCode, { ...input, password: 42 }),
    ).rejects.toThrow(/password/);

    expect(service.redeemEnrollmentCode).toHaveBeenCalledTimes(1);
    expect(service.redeemEnrollmentCode).toHaveBeenCalledWith(input);
  });

  it('passes device and session calls through with checked ids', async () => {
    const { security, call } = harness();

    await call(IPC.deploySecurity.listDevices, 'srv-1');
    await call(IPC.deploySecurity.revokeDevice, 'srv-1', USER);
    await call(IPC.deploySecurity.listSessions, 'srv-1');
    await call(IPC.deploySecurity.revokeSession, 'srv-1', USER);
    await call(IPC.deploySecurity.revokeOtherSessions, 'srv-1');
    await expect(call(IPC.deploySecurity.revokeDevice, 'srv-1', 'x')).rejects.toThrow(/device/);
    await expect(call(IPC.deploySecurity.revokeSession, 'srv-1', 7)).rejects.toThrow(/session/);

    expect(security.revokeDevice).toHaveBeenCalledWith('srv-1', USER);
    expect(security.revokeSession).toHaveBeenCalledWith('srv-1', USER);
    expect(security.revokeOtherSessions).toHaveBeenCalledWith('srv-1');
    expect(security.revokeDevice).toHaveBeenCalledTimes(1);
  });

  it('passes an audit query on with only the filters the core understands', async () => {
    const { security, call } = harness();

    await call(IPC.deploySecurity.queryAudit, {
      serverId: 'srv-1',
      action: 'auth.',
      actor: 'maria',
      result: 'failed',
      fromUnixMs: 1,
      toUnixMs: 2,
      beforeId: 40,
      limit: 50,
      extra: 'dropped',
    });
    await call(IPC.deploySecurity.queryAudit, { serverId: 'srv-1', action: '', actor: '' });
    await call(IPC.deploySecurity.verifyAudit, 'srv-1');

    expect(security.queryAudit).toHaveBeenNthCalledWith(1, {
      serverId: 'srv-1',
      action: 'auth.',
      actor: 'maria',
      result: 'failed',
      fromUnixMs: 1,
      toUnixMs: 2,
      beforeId: 40,
      limit: 50,
    });
    expect(security.queryAudit).toHaveBeenNthCalledWith(2, { serverId: 'srv-1' });
    expect(security.verifyAudit).toHaveBeenCalledWith('srv-1');
  });

  it('refuses an audit filter the core would not understand', async () => {
    const { security, call } = harness();

    for (const filter of [
      { result: 'maybe' },
      { action: 'auth login; drop' },
      { fromUnixMs: -1 },
      { toUnixMs: Number.NaN },
      { beforeId: 0 },
      { limit: 500 },
      { actor: 'x'.repeat(300) },
    ]) {
      await expect(
        call(IPC.deploySecurity.queryAudit, { serverId: 'srv-1', ...filter }),
        JSON.stringify(filter),
      ).rejects.toThrow();
    }
    expect(security.queryAudit).not.toHaveBeenCalled();
  });

  it('exports the audit trail as JSON or CSV with the filter checked the same way', async () => {
    const { security, call } = harness();

    await call(IPC.deploySecurity.exportAudit, {
      serverId: 'srv-1',
      format: 'csv',
      filter: { result: 'denied', unknown: true },
    });
    await expect(
      call(IPC.deploySecurity.exportAudit, { serverId: 'srv-1', format: 'xlsx', filter: {} }),
    ).rejects.toThrow(/JSON or CSV/);
    await expect(
      call(IPC.deploySecurity.exportAudit, {
        serverId: 'srv-1',
        format: 'json',
        filter: { result: 'maybe' },
      }),
    ).rejects.toThrow();

    expect(security.exportAudit).toHaveBeenCalledTimes(1);
    expect(security.exportAudit).toHaveBeenCalledWith({
      serverId: 'srv-1',
      format: 'csv',
      filter: { result: 'denied' },
    });
  });
});
