import { coreErrorMessage } from '@shared/coreErrors';
import { screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { MINUTE, SERVER, UNAUTHORIZED } from './testing/fixtures';
import { useStepUp } from './useStepUp';

/**
 * Changes to users go through the core's step-up: the password (or an authenticator code) from
 * the last ten minutes. The app asks only when the window has passed, remembers the new one, and
 * asks again if the core turns a change down anyway.
 */

const PASSWORD = 'correct horse battery staple';

function Harness({ work }: { work: () => Promise<string> }): React.JSX.Element {
  const stepUp = useStepUp(SERVER);
  const [result, setResult] = useState('none');
  return (
    <>
      <button
        type="button"
        onClick={() =>
          void stepUp.run(work).then(
            (value) => setResult(value ?? 'backed out'),
            (error: unknown) => setResult(`error: ${coreErrorMessage(error)}`),
          )
        }
      >
        Change something
      </button>
      <output aria-label="Result">{result}</output>
      {stepUp.dialog}
    </>
  );
}

function renderHarness(work: () => Promise<string>, bridge: Record<string, unknown> = {}) {
  return renderWithProviders(<Harness work={work} />, {
    bridge: {
      'deploy.account': async () => ({ twoFactorEnabled: false }),
      'deploy.stepUp': async () => ({ stepUpUntilUnixMs: Date.now() + 10 * MINUTE }),
      ...bridge,
    },
  });
}

async function result(): Promise<string> {
  await waitFor(() => expect(screen.getByLabelText('Result').textContent).not.toBe('none'));
  return screen.getByLabelText('Result').textContent ?? '';
}

describe('useStepUp', () => {
  it('goes ahead without asking when the core took the password a few minutes ago', async () => {
    const work = vi.fn(async () => 'done');
    const { user } = renderHarness(work, {
      'deploy.account': async () => ({ stepUpUntilUnixMs: Date.now() + 5 * MINUTE }),
    });

    await user.click(screen.getByRole('button', { name: 'Change something' }));

    expect(await result()).toBe('done');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks for the password first once the window has passed, then goes ahead', async () => {
    const work = vi.fn(async () => 'done');
    const { user, bridge } = renderHarness(work);

    await user.click(screen.getByRole('button', { name: 'Change something' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm it is you' });
    expect(work).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await result()).toBe('done');
    expect(bridge.$fn('deploy.stepUp')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      password: PASSWORD,
    });
    await waitFor(() => expect(dialog.isConnected).toBe(false));
  });

  it('remembers the new window, so the next change does not ask again', async () => {
    const work = vi.fn(async () => 'done');
    const { user, bridge } = renderHarness(work);

    await user.click(screen.getByRole('button', { name: 'Change something' }));
    await user.type(await screen.findByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(work).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Change something' }));

    await waitFor(() => expect(work).toHaveBeenCalledTimes(2));
    expect(bridge.$fn('deploy.stepUp')).toHaveBeenCalledTimes(1);
    expect(bridge.$fn('deploy.account')).toHaveBeenCalledTimes(1);
  });

  it('asks once more when the core turns the change down, then tries it again', async () => {
    const work = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error(UNAUTHORIZED))
      .mockResolvedValueOnce('done');
    const { user } = renderHarness(work, {
      'deploy.account': async () => ({ stepUpUntilUnixMs: Date.now() + 5 * MINUTE }),
    });

    await user.click(screen.getByRole('button', { name: 'Change something' }));
    await user.type(await screen.findByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await result()).toBe('done');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('drops the change when the user backs out of the dialog', async () => {
    const work = vi.fn(async () => 'done');
    const { user } = renderHarness(work);

    await user.click(screen.getByRole('button', { name: 'Change something' }));
    await screen.findByRole('dialog', { name: 'Confirm it is you' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await result()).toBe('backed out');
    expect(work).not.toHaveBeenCalled();
  });

  it('says when the password is wrong and lets the user try again', async () => {
    const work = vi.fn(async () => 'done');
    const stepUp = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Error invoking remote method 'deploy:stepUp': Error: That is not right."),
      )
      .mockResolvedValueOnce({ stepUpUntilUnixMs: Date.now() + 10 * MINUTE });
    const { user } = renderHarness(work, { 'deploy.stepUp': stepUp });

    await user.click(screen.getByRole('button', { name: 'Change something' }));
    await user.type(await screen.findByLabelText('Password'), 'wrong password here');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That is not right.');
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await result()).toBe('done');
  });

  it('takes a code from the authenticator app instead when two-factor is on', async () => {
    const work = vi.fn(async () => 'done');
    const { user, bridge } = renderHarness(work, {
      'deploy.account': async () => ({ twoFactorEnabled: true }),
    });

    await user.click(screen.getByRole('button', { name: 'Change something' }));
    await user.click(
      await screen.findByRole('button', { name: 'Use a code from your authenticator app' }),
    );
    await user.type(screen.getByLabelText('Authenticator code'), '123 456');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await result()).toBe('done');
    expect(bridge.$fn('deploy.stepUp')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      totpCode: '123456',
    });
  });

  it('asks when the core cannot say how long the window lasts', async () => {
    const work = vi.fn(async () => 'done');
    const { user } = renderHarness(work, {
      'deploy.account': async () => {
        throw new Error('WebSocket closed');
      },
    });

    await user.click(screen.getByRole('button', { name: 'Change something' }));

    expect(await screen.findByRole('dialog', { name: 'Confirm it is you' })).toBeTruthy();
  });

  it('passes any other refusal on to the caller', async () => {
    const work = vi.fn(async (): Promise<string> => {
      throw new Error(
        "Error invoking remote method 'deploySecurity:createUser': Error: Username 'sam' is already taken.",
      );
    });
    const { user } = renderHarness(work, {
      'deploy.account': async () => ({ stepUpUntilUnixMs: Date.now() + 5 * MINUTE }),
    });

    await user.click(screen.getByRole('button', { name: 'Change something' }));

    expect(await result()).toBe("error: Username 'sam' is already taken.");
  });
});
