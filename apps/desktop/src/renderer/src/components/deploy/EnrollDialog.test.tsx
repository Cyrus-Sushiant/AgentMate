import type { DeployServer } from '@shared/deployTypes';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { EnrollDialog } from './EnrollDialog';

/**
 * Enrolling this computer on a core it is not on (or was removed from). The key is registered
 * over SSH as root, so the sudo password is asked for only when the saved login cannot stand in.
 */

const SERVER: DeployServer = {
  id: 'srv-1',
  nickname: 'Production',
  host: 'prod.example',
  port: 22,
  username: 'deployer',
  core: null,
  enrolled: false,
};

const ACCOUNT = { userName: 'maria', password: 'correct horse battery staple' };

function renderDialog(enroll: (input: unknown) => Promise<unknown>) {
  const onOpenChange = vi.fn();
  const onEnrolled = vi.fn();
  const view = renderWithProviders(
    <EnrollDialog server={SERVER} open onOpenChange={onOpenChange} onEnrolled={onEnrolled} />,
    { bridge: { 'deploy.enroll': enroll } },
  );
  return { ...view, onOpenChange, onEnrolled };
}

async function fillAccount(user: ReturnType<typeof renderDialog>['user']): Promise<void> {
  await user.type(screen.getByLabelText('User name'), ACCOUNT.userName);
  await user.type(screen.getByLabelText('Password'), ACCOUNT.password);
}

describe('EnrollDialog', () => {
  it('enrolls with an account the core has, then closes', async () => {
    const { user, bridge, onOpenChange, onEnrolled } = renderDialog(async () => ({
      state: 'signed-in',
    }));
    const submit = screen.getByRole('button', { name: 'Enroll' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByLabelText('Confirm the password')).toBeNull();

    await fillAccount(user);
    await user.click(submit);

    expect(bridge.$fn('deploy.enroll')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      sudoPassword: null,
      account: ACCOUNT,
    });
    expect(onEnrolled).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('asks for the sudo password when the server wants one, then sends it', async () => {
    let calls = 0;
    const { user, bridge } = renderDialog(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error(
          "Error invoking remote method 'deploy:enroll': Error: [ssh:sudo-password-required] Running this as root on prod.example needs the sudo password for deployer.",
        );
      }
      return { state: 'signed-in' };
    });

    await fillAccount(user);
    await user.click(screen.getByRole('button', { name: 'Enroll' }));

    expect(await screen.findByText('This server needs the sudo password to go on.')).toBeTruthy();
    const submit = screen.getByRole('button', { name: 'Enroll' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText('Sudo password for deployer'), 'sudo-pw');
    await user.click(submit);

    expect(bridge.$fn('deploy.enroll')).toHaveBeenLastCalledWith({
      serverId: 'srv-1',
      sudoPassword: 'sudo-pw',
      account: ACCOUNT,
    });
  });

  it("shows why enrolling failed in the core's words, without the code", async () => {
    const { user, onEnrolled } = renderDialog(async () => {
      throw new Error(
        "Error invoking remote method 'deploy:enroll': Error: [core:invalidCredentials] The user name or password is not right.",
      );
    });

    await fillAccount(user);
    await user.click(screen.getByRole('button', { name: 'Enroll' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The user name or password is not right.',
    );
    expect(onEnrolled).not.toHaveBeenCalled();
  });
});
