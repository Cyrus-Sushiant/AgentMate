import type {
  DeployAccess,
  DeployCoreRecord,
  DeployHealth,
  DeployPreflight,
  DeployServer,
  DeploySetupProgressEvent,
} from '@shared/deployTypes';
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogHost } from '@/components/ConfirmDialog';
import { useDeploySetupStore } from '@/stores/deploySetupStore';
import { renderWithProviders } from '../../../test/renderer/renderWithProviders';

/**
 * The Deploy page: pick a saved server, see whether its core answers, and install or remove the
 * core without typing a command. Each state (loading, empty, failed, working) has to say what is
 * going on in words, and a sudo password is only asked for when nothing saved can stand in.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast }));

const { default: DeployPage } = await import('./DeployPage');

const CORE: DeployCoreRecord = {
  version: '1.53.0',
  release: '/opt/agentmate-core/releases/1.53.0-abababababab',
  transport: 'streamlocal',
  installedAt: Date.now() - 3 * 86_400_000,
  os: 'Ubuntu 24.04.1 LTS',
  architecture: 'x86_64',
};

function server(overrides: Partial<DeployServer> = {}): DeployServer {
  return {
    id: 'srv-1',
    nickname: 'Production',
    host: 'prod.example',
    port: 22,
    username: 'deployer',
    core: null,
    enrolled: false,
    ...overrides,
  };
}

const PREFLIGHT: DeployPreflight = {
  os: 'Ubuntu 24.04.1 LTS',
  supported: true,
  architecture: 'x86_64',
  architectureSupported: true,
  systemd: true,
  sudo: 'password',
  loginUser: 'deployer',
  hasSavedPassword: true,
  transport: 'streamlocal',
  selinux: 'absent',
  freeDiskMb: 19_531,
  installed: null,
  available: '1.53.0',
  problems: [],
};

const HEALTH: DeployHealth = {
  version: '1.53.0',
  apiVersion: 1,
  startedAtUnixMs: Date.now() - (2 * 60 + 5) * 60_000,
  checkedAt: Date.now(),
};

/** The owner a first install creates, typed into the account fields. */
const OWNER = { userName: 'maria', password: 'correct horse battery staple' };

async function fillOwner(user: ReturnType<typeof renderPage>['user']): Promise<void> {
  await user.type(await screen.findByLabelText('User name'), OWNER.userName);
  await user.type(screen.getByLabelText('Password'), OWNER.password);
  await user.type(screen.getByLabelText('Confirm the password'), OWNER.password);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderPage(bridge: Record<string, unknown> = {}, route = '/deploy') {
  return renderWithProviders(
    <>
      <DeployPage />
      <ConfirmDialogHost />
    </>,
    {
      route,
      bridge: {
        'deploy.listServers': async () => [server()],
        'deploy.preflight': async () => PREFLIGHT,
        'deploy.health': async () => HEALTH,
        'deploy.access': async (): Promise<DeployAccess> => ({ state: 'not-enrolled' }),
        'ssh.vaultStatus': async () => ({ hasPasskey: false, unlocked: false }),
        ...bridge,
      },
    },
  );
}

beforeEach(() => {
  useDeploySetupStore.setState({ runs: {} });
  toast.success.mockClear();
  toast.warning.mockClear();
});

describe('DeployPage states', () => {
  it('shimmers while the servers load', () => {
    const { container } = renderPage({ 'deploy.listServers': () => new Promise(() => undefined) });

    expect(container.querySelector('[aria-busy="true"] .shimmer')).not.toBeNull();
  });

  it('points to Remote when there are no saved servers', async () => {
    renderPage({ 'deploy.listServers': async () => [] });

    expect(await screen.findByText('No servers yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Open Remote/ })).toBeTruthy();
  });

  it('leads to the Cloudflare page, with servers or without', async () => {
    const { unmount } = renderPage({ 'deploy.listServers': async () => [] });
    expect(await screen.findByRole('button', { name: /Manage Cloudflare/ })).toBeTruthy();
    unmount();

    renderPage();
    const rail = await screen.findByRole('navigation', { name: 'Servers' });
    expect(
      within(rail)
        .getByRole('link', { name: /Cloudflare/ })
        .getAttribute('href'),
    ).toBe('/deploy/cloudflare');
  });

  it('says why the list failed and offers to try again', async () => {
    const { user, bridge } = renderPage({
      'deploy.listServers': async () => {
        throw new Error("Error invoking remote method 'deploy:listServers': Error: disk is gone");
      },
    });

    expect(await screen.findByText('disk is gone')).toBeTruthy();
    bridge.$set('deploy.listServers', async () => [server()]);
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByRole('heading', { name: 'Production' })).toBeTruthy();
  });

  it('shows a live health card for a server whose core answers', async () => {
    renderPage({ 'deploy.listServers': async () => [server({ core: CORE })] });

    expect(await screen.findByText('Online')).toBeTruthy();
    expect(screen.getByText('2 h 5 min')).toBeTruthy();
    expect(screen.getByText('Ubuntu 24.04.1 LTS')).toBeTruthy();
    const rail = screen.getByRole('navigation', { name: 'Servers' });
    expect(await within(rail).findByText('Online, core 1.53.0')).toBeTruthy();
  });

  it('says so, in words, when the core stops answering', async () => {
    renderPage({
      'deploy.listServers': async () => [server({ core: CORE })],
      'deploy.health': async () => {
        throw new Error('The server core did not answer GET /api/v1/health in time.');
      },
    });

    expect(await screen.findByText('Not answering', { selector: 'div' })).toBeTruthy();
    expect(screen.getByText(/did not answer GET \/api\/v1\/health/)).toBeTruthy();
    const rail = screen.getByRole('navigation', { name: 'Servers' });
    expect(within(rail).getByText('Not answering')).toBeTruthy();
  });

  it('asks to unlock the saved servers when a passkey locks them', async () => {
    renderPage({ 'ssh.vaultStatus': async () => ({ hasPasskey: true, unlocked: false }) });

    expect(await screen.findByText(/locked with a passkey/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeTruthy();
  });

  it('marks the DevHost and offers no install or removal for it', async () => {
    renderPage({
      'deploy.listServers': async () => [
        server({
          id: 'devhost',
          nickname: 'DevHost',
          dev: true,
          core: { ...CORE, transport: 'dev-tcp' },
        }),
      ],
    });

    expect(await screen.findByText('Development')).toBeTruthy();
    expect(await screen.findByText('Online')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });
});

describe('DeployPage install', () => {
  it('checks a server without a core on its own and lists what it found', async () => {
    renderPage();

    expect(await screen.findByText('Ubuntu 24.04.1 LTS')).toBeTruthy();
    expect(screen.getByText('sudo, with the saved login password')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Install core 1\.53\.0/ })).toBeTruthy();
  });

  it('installs with one click, shows each step, and says when it is done', async () => {
    const call = deferred<unknown>();
    const { user, bridge } = renderPage({ 'deploy.install': () => call.promise });

    const install = await screen.findByRole('button', { name: /Install core 1\.53\.0/ });
    expect((install as HTMLButtonElement).disabled).toBe(true);
    await fillOwner(user);
    await user.click(install);

    expect(bridge.$fn('deploy.install')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      sudoPassword: null,
      account: OWNER,
    });
    const emit = (progress: DeploySetupProgressEvent['progress']) =>
      bridge.$emit('deploy.onSetupProgress', { serverId: 'srv-1', progress });
    emit({ phase: 'preflight', title: 'Check the server', status: 'done' });
    emit({ phase: 'upload', title: 'Upload', status: 'running', percent: 42 });
    const steps = await screen.findByRole('list', { name: 'Install steps' });
    expect(within(steps).getByText('Check the server')).toBeTruthy();
    expect(await screen.findByRole('progressbar', { name: /42 percent/ })).toBeTruthy();

    bridge.$set('deploy.listServers', async () => [server({ core: CORE })]);
    call.resolve({
      version: '1.53.0',
      release: CORE.release,
      transport: 'streamlocal',
      previousVersion: null,
    });

    expect(await screen.findByText('Online')).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith('Server core 1.53.0 is running on Production.');
  });

  it('asks for the sudo password when the login has none saved', async () => {
    const { user, bridge } = renderPage({
      'deploy.preflight': async () => ({ ...PREFLIGHT, hasSavedPassword: false }),
      'deploy.install': () => new Promise(() => undefined),
    });

    const install = await screen.findByRole('button', { name: /Install core/ });
    await fillOwner(user);
    expect((install as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText('Sudo password for deployer'), 's3cret');
    await user.click(install);

    expect(bridge.$fn('deploy.install')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      sudoPassword: 's3cret',
      account: OWNER,
    });
  });

  it('asks again when the server turns the password down', async () => {
    const { user } = renderPage({
      'deploy.install': async () => {
        throw new Error(
          "Error invoking remote method 'deploy:install': Error: [ssh:sudo-password-rejected] prod.example did not accept the sudo password for deployer.",
        );
      },
    });

    await fillOwner(user);
    await user.click(await screen.findByRole('button', { name: /Install core/ }));

    expect(await screen.findByText('The server did not accept that password.')).toBeTruthy();
    expect(screen.getByLabelText('Sudo password for deployer')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeTruthy();
  });

  it('explains a failed install and keeps the core log out of the way', async () => {
    const { user } = renderPage({
      'deploy.install': async () => {
        throw new Error(
          'Server core 1.53.0 did not start. The server went back to 1.52.0.\n\nWhat the core logged:\nUnhandled exception. Boom.',
        );
      },
    });

    await fillOwner(user);
    await user.click(await screen.findByRole('button', { name: /Install core/ }));

    expect(
      await screen.findByText(/did not start\. The server went back to 1\.52\.0\./),
    ).toBeTruthy();
    expect(screen.getByText('What the core logged')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Check the server again/ })).toBeTruthy();
  });

  it('can try a failed install again after the page was left and opened again', async () => {
    useDeploySetupStore.setState({
      runs: {
        'srv-1': {
          kind: 'install',
          planned: ['preflight', 'download'],
          events: [{ phase: 'download', title: 'Get', status: 'failed', detail: 'offline' }],
          status: 'failed',
          error: 'The server core download kept failing.',
          errorCode: null,
          result: null,
        },
      },
    });
    const { user, bridge } = renderPage({ 'deploy.install': () => new Promise(() => undefined) });

    // The account typed before went away with the page, so it is asked for again.
    const retry = await screen.findByRole('button', { name: /Try again/ });
    await fillOwner(user);
    await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false));
    await user.click(retry);

    expect(bridge.$fn('deploy.install')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      sudoPassword: null,
      account: OWNER,
    });
  });

  it('keeps Install off until the owner account follows the rules, and says which one', async () => {
    const { user } = renderPage();

    const install = await screen.findByRole('button', { name: /Install core 1\.53\.0/ });
    await user.type(screen.getByLabelText('User name'), 'maria');
    await user.type(screen.getByLabelText('Password'), 'short');

    expect(await screen.findByText('The password needs at least 12 characters.')).toBeTruthy();
    expect((install as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText('Password'), ' but longer now');
    await user.type(screen.getByLabelText('Confirm the password'), 'something else entirely');
    expect(await screen.findByText('The two passwords differ.')).toBeTruthy();
    expect((install as HTMLButtonElement).disabled).toBe(true);
  });

  it('warns, without failing the install, when access could not be set up', async () => {
    const { user } = renderPage({
      'deploy.install': async () => ({
        version: '1.53.0',
        release: CORE.release,
        transport: 'streamlocal',
        previousVersion: null,
        enrollmentError: 'The core refused the password: it is too common.',
      }),
    });

    await fillOwner(user);
    await user.click(await screen.findByRole('button', { name: /Install core 1\.53\.0/ }));

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        'Your access to Production is not set up yet: The core refused the password: it is too common. Set it up from the server card.',
      ),
    );
    expect(toast.success).toHaveBeenCalledWith('Server core 1.53.0 is running on Production.');
  });

  it('will not start an install the check says cannot work', async () => {
    renderPage({
      'deploy.preflight': async () => ({
        ...PREFLIGHT,
        supported: false,
        os: 'Alpine Linux v3.20',
        problems: ['Alpine Linux v3.20 is not supported.'],
      }),
    });

    expect(await screen.findByText('This server cannot take the core yet')).toBeTruthy();
    expect(screen.getByText('Alpine Linux v3.20 is not supported.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: /Install core/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('DeployPage checks and updates', () => {
  it('says why a check failed and checks again on request', async () => {
    let calls = 0;
    const { user } = renderPage({
      'deploy.preflight': async () => {
        calls += 1;
        if (calls === 1) throw new Error('Could not reach prod.example: connection refused');
        return PREFLIGHT;
      },
    });

    expect(await screen.findByText(/connection refused/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Check again/ }));

    expect(await screen.findByRole('button', { name: /Install core 1\.53\.0/ })).toBeTruthy();
  });

  it('takes a different sudo password even when one is saved', async () => {
    const { user, bridge } = renderPage({ 'deploy.install': () => new Promise(() => undefined) });

    await fillOwner(user);
    await user.click(await screen.findByRole('button', { name: 'Use a different password' }));
    await user.type(screen.getByLabelText('Sudo password for deployer'), 'other-pw');
    await user.keyboard('{Enter}');

    expect(bridge.$fn('deploy.install')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      sudoPassword: 'other-pw',
      account: OWNER,
    });
  });

  it('offers an update from the health card and lets the user back out', async () => {
    const { user } = renderPage({
      'deploy.listServers': async () => [server({ core: { ...CORE, version: '1.52.0' } })],
      'deploy.preflight': async () => ({ ...PREFLIGHT, installed: { version: '1.52.0' } }),
    });

    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /Update or reinstall/ }));

    expect(await screen.findByRole('button', { name: /Update to core 1\.53\.0/ })).toBeTruthy();
    expect(screen.getByText('Update or reinstall the server core')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Server core')).toBeTruthy();
  });

  it('lets an update join a core this computer is not on, or leave that for later', async () => {
    const { user, bridge } = renderPage({
      'deploy.listServers': async () => [server({ core: { ...CORE, version: '1.52.0' } })],
      'deploy.preflight': async () => ({ ...PREFLIGHT, installed: { version: '1.52.0' } }),
      'deploy.install': () => new Promise(() => undefined),
    });

    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /Update or reinstall/ }));
    const update = await screen.findByRole('button', { name: /Update to core 1\.53\.0/ });
    expect(screen.getByText('Your account on this core')).toBeTruthy();
    expect(screen.queryByLabelText('Confirm the password')).toBeNull();
    expect((update as HTMLButtonElement).disabled).toBe(false);

    await user.click(update);

    expect(bridge.$fn('deploy.install')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      sudoPassword: null,
    });
  });

  it('sends the account along when one is given during an update', async () => {
    const { user, bridge } = renderPage({
      'deploy.listServers': async () => [server({ core: { ...CORE, version: '1.52.0' } })],
      'deploy.preflight': async () => ({ ...PREFLIGHT, installed: { version: '1.52.0' } }),
      'deploy.install': () => new Promise(() => undefined),
    });

    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /Update or reinstall/ }));
    const update = await screen.findByRole('button', { name: /Update to core 1\.53\.0/ });
    await user.type(screen.getByLabelText('User name'), OWNER.userName);
    expect((update as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText('Password'), OWNER.password);
    await user.click(update);

    expect(bridge.$fn('deploy.install')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      sudoPassword: null,
      account: OWNER,
    });
  });

  it('asks for no account when this computer is already on the core', async () => {
    const { user } = renderPage({
      'deploy.listServers': async () => [
        server({ core: { ...CORE, version: '1.52.0' }, enrolled: true }),
      ],
      'deploy.preflight': async () => ({ ...PREFLIGHT, installed: { version: '1.52.0' } }),
    });

    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /Update or reinstall/ }));

    expect(await screen.findByRole('button', { name: /Update to core 1\.53\.0/ })).toBeTruthy();
    expect(screen.queryByLabelText('User name')).toBeNull();
  });

  it('asks the core again when "Check now" is pressed', async () => {
    let calls = 0;
    const { user } = renderPage({
      'deploy.listServers': async () => [server({ core: CORE })],
      'deploy.health': async () => {
        calls += 1;
        return { ...HEALTH, version: calls > 1 ? '1.53.1' : '1.53.0' };
      },
    });
    await screen.findByText('Online');

    await user.click(screen.getByRole('button', { name: 'Check now' }));

    expect(await screen.findByText('1.53.1')).toBeTruthy();
  });
});

describe('DeployPage removal', () => {
  it('removes the core after a confirmation and keeps its data by default', async () => {
    const { user, bridge } = renderPage({
      'deploy.listServers': async () => [server({ core: CORE })],
      'deploy.uninstall': async () => undefined,
    });

    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /keep its data/ }));
    await user.click(await screen.findByRole('button', { name: 'Remove the core' }));

    await waitFor(() =>
      expect(bridge.$fn('deploy.uninstall')).toHaveBeenCalledWith({
        serverId: 'srv-1',
        keepData: true,
        sudoPassword: null,
      }),
    );
  });

  it('warns before removing the core together with its data', async () => {
    const { user, bridge } = renderPage({
      'deploy.listServers': async () => [server({ core: CORE })],
      'deploy.uninstall': async () => undefined,
    });

    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /and its data/ }));

    expect(await screen.findByText('Deleted data cannot be brought back.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remove the core and its data' }));
    await waitFor(() =>
      expect(bridge.$fn('deploy.uninstall')).toHaveBeenCalledWith({
        serverId: 'srv-1',
        keepData: false,
        sudoPassword: null,
      }),
    );
  });

  it('shows why a removal stopped and retries with the sudo password', async () => {
    let calls = 0;
    const { user, bridge } = renderPage({
      'deploy.listServers': async () => [server({ core: CORE })],
      'deploy.uninstall': async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error(
            '[ssh:sudo-password-required] Running this as root on prod.example needs the sudo password for deployer.',
          );
        }
        return new Promise(() => undefined);
      },
    });

    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /keep its data/ }));
    await user.click(await screen.findByRole('button', { name: 'Remove the core' }));

    expect(await screen.findByText('This server needs the sudo password to go on.')).toBeTruthy();
    const retry = screen.getByRole('button', { name: /Try again/ });
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText('Sudo password for deployer'), 'pw');
    await user.click(retry);

    expect(bridge.$fn('deploy.uninstall')).toHaveBeenLastCalledWith({
      serverId: 'srv-1',
      keepData: true,
      sudoPassword: 'pw',
    });
    expect(screen.getByRole('list', { name: 'Removal steps' })).toBeTruthy();
  });

  it('goes back to the health card when a failed removal is dismissed', async () => {
    const { user } = renderPage({
      'deploy.listServers': async () => [server({ core: CORE })],
      'deploy.uninstall': async () => {
        throw new Error('Stop the server core failed: Failed to stop agentmate-core.service');
      },
    });

    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /keep its data/ }));
    await user.click(await screen.findByRole('button', { name: 'Remove the core' }));
    expect(await screen.findByText(/Failed to stop agentmate-core\.service/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(await screen.findByText('Online')).toBeTruthy();
  });
});

describe('DeployPage security', () => {
  it("opens the selected server's Security area, and goes back to the overview", async () => {
    const { user } = renderPage({
      'deploy.listServers': async () => [server({ core: CORE, enrolled: true })],
      'deploy.access': async (): Promise<DeployAccess> => ({
        state: 'signed-in',
        user: { userName: 'maria', roles: ['viewer'], twoFactorEnabled: false },
      }),
      'deploySecurity.listDevices': async () => [],
      'deploySecurity.listSessions': async () => [],
    });

    const sections = await screen.findByRole('navigation', { name: 'Server sections' });
    await user.click(within(sections).getByRole('button', { name: /Security/ }));

    expect(await screen.findByText('No computers are enrolled on this core.')).toBeTruthy();
    expect(
      within(sections)
        .getByRole('button', { name: /Security/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    await user.click(within(sections).getByRole('button', { name: 'Overview' }));
    expect(await screen.findByText('Online')).toBeTruthy();
  });

  it("opens the selected server's Websites section", async () => {
    const { user } = renderPage({
      'deploy.listServers': async () => [server({ core: CORE, enrolled: true })],
      'deploy.access': async (): Promise<DeployAccess> => ({ state: 'needs-sign-in' }),
    });

    const sections = await screen.findByRole('navigation', { name: 'Server sections' });
    await user.click(within(sections).getByRole('button', { name: /Websites/ }));

    expect(await screen.findByText(/Sign in to see the websites on/)).toBeTruthy();
    expect(
      within(sections)
        .getByRole('button', { name: /Websites/ })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('opens the Security area straight from a link', async () => {
    renderPage(
      {
        'deploy.listServers': async () => [server({ core: CORE, enrolled: true })],
        'deploy.access': async (): Promise<DeployAccess> => ({ state: 'needs-sign-in' }),
      },
      '/deploy?server=srv-1&view=security',
    );

    expect(await screen.findByText(/Sign in to see who can reach Production/)).toBeTruthy();
  });

  it('offers to join a core that already runs there with an enrollment code, no sudo needed', async () => {
    let joined = false;
    const { user, bridge } = renderPage({
      'deploy.listServers': async () => [
        joined ? server({ core: CORE, enrolled: true }) : server(),
      ],
      'deploy.preflight': async () => ({
        ...PREFLIGHT,
        sudo: null,
        installed: { version: '1.53.0' },
        problems: ['sudo is not installed on prod.example.'],
      }),
      'deploySecurity.redeemEnrollmentCode': async () => {
        joined = true;
        return { state: 'signed-in' };
      },
    });

    await user.click(await screen.findByRole('button', { name: /Join with a code/ }));
    await user.type(await screen.findByLabelText('Enrollment code'), 'K7Q2M-X9PLR');
    await user.type(screen.getByLabelText('User name'), 'sam');
    await user.type(screen.getByLabelText('Password'), 'another long passphrase');
    await user.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByText('Online')).toBeTruthy();
    expect(bridge.$fn('deploySecurity.redeemEnrollmentCode')).toHaveBeenCalledWith(
      expect.objectContaining({ serverId: 'srv-1', userName: 'sam' }),
    );
  });

  it('offers no code path when this computer is already on the core', async () => {
    renderPage({
      'deploy.listServers': async () => [server({ enrolled: true })],
      'deploy.preflight': async () => ({ ...PREFLIGHT, installed: { version: '1.52.0' } }),
    });

    expect(await screen.findByRole('button', { name: /Update to core 1.53.0/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Join with a code/ })).toBeNull();
  });
});
