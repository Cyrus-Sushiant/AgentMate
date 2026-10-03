import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../../test/renderer/renderWithProviders';
import { SERVER } from '../testing/fixtures';
import { CHECKLIST, change, PREVIEW } from './testing/fixtures';

/**
 * The Security checklist in every state: shimmer, error with a retry, and the list with its score.
 * Each fix previews what it changes: the SSH fix shows the exact file and commands and whether
 * key login is proven, applies only with that proof, and then waits to be kept or reverted.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const confirm = vi.fn(async () => true);
vi.mock('@/stores/confirmStore', () => ({
  confirmDialog: (...args: unknown[]) => confirm(...(args as [])),
}));

const { ChecklistCard } = await import('./ChecklistCard');

const STEP_UP_OK = { twoFactorEnabled: false, stepUpUntilUnixMs: Date.now() + 600_000 };

function renderCard(
  options: {
    checklist?: unknown;
    owner?: boolean;
    admin?: boolean;
    bridge?: Record<string, unknown>;
  } = {},
) {
  const onUpdateCore = vi.fn();
  const rendered = renderWithProviders(
    <ChecklistCard
      server={SERVER}
      owner={options.owner ?? true}
      admin={options.admin ?? true}
      onUpdateCore={onUpdateCore}
    />,
    {
      route: '/deploy?server=srv-1&view=security',
      bridge: {
        'deployHardening.checklist': options.checklist ?? (async () => CHECKLIST),
        'deployHardening.previewSsh': async () => PREVIEW,
        'deployHardening.applySsh': async () => change(),
        'deployHardening.confirmSsh': async () => change({ state: 'confirmed' }),
        'deployHardening.revertSsh': async () => change({ state: 'rolledBack' }),
        'deploy.account': async () => STEP_UP_OK,
        ...options.bridge,
      },
    },
  );
  return { ...rendered, onUpdateCore };
}

const row = (name: RegExp) => screen.getByRole('listitem', { name });

describe('ChecklistCard', () => {
  it('shimmers while the core looks', () => {
    const { container } = renderCard({ checklist: () => new Promise(() => undefined) });

    expect(container.querySelector('[aria-busy="true"] .shimmer')).not.toBeNull();
  });

  it('says what went wrong and tries again', async () => {
    let calls = 0;
    const { user } = renderCard({
      checklist: async () => {
        calls += 1;
        if (calls === 1) throw new Error('The server core did not answer.');
        return CHECKLIST;
      },
    });

    expect(await screen.findByText('The server core did not answer.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Checklist' })).toBeTruthy();
  });

  it('shows the score and every item in words, not by colour alone', async () => {
    renderCard();

    expect(
      await screen.findByRole('img', {
        name: /Score 31 out of 100: 1 done, 4 worth fixing, 3 need fixing, 1 not checked/,
      }),
    ).toBeTruthy();
    expect(screen.getByText('7 things to fix')).toBeTruthy();
    expect(row(/SSH password login off: Needs fixing/)).toBeTruthy();
    expect(row(/No reboot waiting: Done/)).toBeTruthy();
    expect(row(/Two-factor for every Owner: Not checked/)).toBeTruthy();
  });

  it('previews the SSH fix with the exact file, applies it and keeps it over a new connection', async () => {
    const { user, bridge } = renderCard();

    await user.click(await screen.findByRole('button', { name: 'Turn off passwords' }));
    const dialog = await screen.findByRole('dialog', { name: 'SSH password login off' });
    expect(within(dialog).getByLabelText('File contents').textContent).toContain(
      'PasswordAuthentication no',
    );
    expect(within(dialog).getByRole('list', { name: 'Commands' }).textContent).toContain(
      'systemctl reload ssh',
    );
    expect(within(dialog).getByText(/Key login proven/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    expect(bridge.$fn('deployHardening.applySsh')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      disablePasswordLogin: true,
      restrictRootLogin: false,
    });
    expect(await screen.findByRole('heading', { name: 'Keep the SSH change?' })).toBeTruthy();
    expect(screen.getByRole('timer').getAttribute('aria-label')).toMatch(/^\d+ seconds left$/);
    expect(
      screen.getByRole('button', { name: 'Turn off passwords' }).hasAttribute('disabled'),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Keep the change' }));

    expect(bridge.$fn('deployHardening.confirmSsh')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      changeId: change().id,
    });
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Keep the SSH change?' })).toBeNull(),
    );
  });

  it('keeps Apply off when key login is not proven', async () => {
    const { user } = renderCard({
      bridge: {
        'deployHardening.previewSsh': async () => ({
          ...PREVIEW,
          allowed: false,
          proof: {
            keyLoginProven: false,
            explanation: 'This connection signed in with "password", not a key.',
          },
        }),
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Turn off passwords' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/Key login not proven/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('reverts a change that waits', async () => {
    const { user, bridge } = renderCard({
      checklist: async () => ({ ...CHECKLIST, pendingSshChange: change() }),
    });

    await user.click(await screen.findByRole('button', { name: 'Revert' }));

    expect(bridge.$fn('deployHardening.revertSsh')).toHaveBeenCalledWith({
      serverId: 'srv-1',
      changeId: change().id,
    });
  });

  it('confirms before turning on automatic updates and renewing certificates', async () => {
    const { user, bridge } = renderCard();

    await user.click(await screen.findByRole('button', { name: 'Turn on' }));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Turn on automatic security updates?' }),
    );
    expect(bridge.$fn('deploySystem.setAutomaticUpdates')).toHaveBeenCalledWith('srv-1', true);

    await user.click(screen.getByRole('button', { name: 'Renew now' }));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ items: [{ name: 'blog' }] }));
    expect(bridge.$fn('deployCerts.renew')).toHaveBeenCalledWith('srv-1', 'blog');
  });

  it('opens the core update', async () => {
    const { user, onUpdateCore } = renderCard();

    await user.click(await screen.findByRole('button', { name: 'Update the core' }));

    expect(onUpdateCore).toHaveBeenCalled();
  });

  it('leaves the SSH fixes to Owners', async () => {
    renderCard({ owner: false });

    expect(
      (await screen.findByRole('button', { name: 'Turn off passwords' })).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Turn on the firewall' }).hasAttribute('disabled'),
    ).toBe(false);
  });
});
