import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coreErrorCode, encodeCoreError } from '../../shared/coreErrors';
import { FAKE_CORE_PASSWORD, FakeCore } from '../../shared/deploy/testing/fakeCore';
import { CoreLinks } from './live/coreLinks';
import { DeploySystem } from './system';
import { fakeLiveHubs } from './testing/fakeLiveHub';

/**
 * The Overview's calls, on the server's lasting connection: reading the server, and the jobs
 * behind its buttons. Upgrading everything and rebooting need a step-up, which the call can do
 * on the way when it is handed the password; a refusal says whether a step-up or a role is
 * missing, so the renderer knows whether to ask for the password.
 */

let links: CoreLinks | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});

afterEach(() => {
  links?.closeAll();
  links = null;
  vi.useRealTimers();
});

function setup(roles: string[] | null = ['owner']) {
  const core = new FakeCore(() => Date.now());
  if (roles) core.roles = roles;
  const hubs = fakeLiveHubs(core);
  links = new CoreLinks({ open: () => hubs.open() });
  const system = new DeploySystem({ links, roles: () => roles });
  return { core, hubs, system };
}

describe('DeploySystem reads', () => {
  it("answers the Overview's questions on one connection", async () => {
    const { core, hubs, system } = setup();
    core.sample();

    const info = await system.info('srv-1');
    const services = await system.services('srv-1');
    const history = await system.metricsHistory('srv-1', { resolution: 'live' });
    const updates = await system.updates('srv-1');
    const jobs = await system.jobs('srv-1', { activeOnly: false });
    const alerts = await system.alerts('srv-1', { includeResolved: false });

    expect(info.os.name).toBe('Ubuntu 24.04.1 LTS');
    expect(services.map((service) => service.name)).toContain('Docker');
    expect(history.samples).toHaveLength(1);
    expect(updates.securityCount).toBe(1);
    expect(jobs.jobs).toEqual([]);
    expect(alerts).toEqual([]);
    expect(hubs.opens()).toBe(1);
  });

  it('reads a job and says plainly when there is no such job', async () => {
    const { system } = setup();
    const started = await system.checkUpdates('srv-1');

    expect((await system.job('srv-1', started.id)).kind).toBe('packagesRefresh');
    await expect(system.job('srv-1', '00000000-0000-4000-8000-0000000000ff')).rejects.toThrow(
      /^There is no such job\.$/,
    );
  });
});

describe('DeploySystem jobs', () => {
  it('starts the jobs behind the buttons and stops one on request', async () => {
    const { core, system } = setup();

    const check = await system.checkUpdates('srv-1');
    await expect(system.upgradeSecurity('srv-1')).rejects.toThrow(/already working on packages/);
    await system.cancelJob('srv-1', check.id);
    const security = await system.upgradeSecurity('srv-1');
    const docker = await system.restartService('srv-1', 'docker');
    core.finishJob(security.id, 'succeeded', 0);
    const automatic = await system.setAutomaticUpdates('srv-1', true);

    expect(core.job(check.id).info.state).toBe('cancelled');
    expect(security.kind).toBe('packagesUpgradeSecurity');
    expect(docker).toMatchObject({ kind: 'serviceRestart', title: 'Restart Docker' });
    expect(automatic.title).toBe('Turn on automatic security updates');
  });

  it('steps up on the way when handed the password, then upgrades everything', async () => {
    const { core, system } = setup();

    const job = await system.upgradeAll({ serverId: 'srv-1', password: FAKE_CORE_PASSWORD });

    expect(job.kind).toBe('packagesUpgrade');
    expect(core.stepUpUntil).toBeGreaterThan(Date.now());
  });

  it('asks for a step-up when there is none, so the renderer can ask for the password', async () => {
    const { system } = setup(['operator']);

    const refusal = await system.reboot({ serverId: 'srv-1' }).catch((error: unknown) => error);

    expect(coreErrorCode(refusal)).toBe('stepUpRequired');
  });

  it('reboots within a step-up made earlier', async () => {
    const { core, system } = setup();
    core.stepUpUntil = Date.now() + 60_000;

    const job = await system.reboot({ serverId: 'srv-1' });

    expect(job).toMatchObject({ kind: 'reboot', cancellable: false });
    expect(core.rebootRequested).toBe(true);
  });

  it('says when the role is what is missing, whatever the step-up', async () => {
    const viewer = setup(['viewer']);
    const refusal = await viewer.system
      .upgradeAll({ serverId: 'srv-1', password: FAKE_CORE_PASSWORD })
      .catch((error: unknown) => error);
    expect(coreErrorCode(refusal)).toBe('forbidden');
    expect(String(refusal)).toMatch(/viewer/);
    links?.closeAll();

    const operator = setup(['operator']);
    const admin = await operator.system
      .setAutomaticUpdates('srv-1', false)
      .catch((error: unknown) => error);
    expect(coreErrorCode(admin)).toBe('forbidden');
  });

  it('treats a step-up refusal as one when it does not know the roles', async () => {
    const { system } = setup(null);

    const refusal = await system.reboot({ serverId: 'srv-1' }).catch((error: unknown) => error);

    expect(coreErrorCode(refusal)).toBe('stepUpRequired');
  });

  it("passes a wrong step-up password on in the core's words", async () => {
    const { system } = setup();

    await expect(system.upgradeAll({ serverId: 'srv-1', password: 'wrong' })).rejects.toThrow(
      /^That password is not right\.$/,
    );
  });

  it('acknowledges an alert', async () => {
    const { core, system } = setup();
    core.raise('diskPressure', '/', 'warning', '/ is 91% full.');

    const acknowledged = await system.acknowledgeAlert('srv-1', 1);

    expect(acknowledged.acknowledgedBy).toBe('maria');
  });

  it('keeps a code the connection gave, such as a session that ended', async () => {
    const { hubs, system } = setup();
    hubs.failNext(new Error(encodeCoreError('sessionExpired', 'Sign in again.')));

    const refusal = await system.info('srv-1').catch((error: unknown) => error);

    expect(coreErrorCode(refusal)).toBe('sessionExpired');
  });
});
