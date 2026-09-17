// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createVaultApiMock,
  expectNoNativeTitles,
  installDomShims,
  installVaultApi,
  renderWithVaultProviders,
  type VaultApiMock,
} from './testing/mockVaultApi';

installDomShims();

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { ResetVaultDialog } = await import('./ResetVaultDialog');

let mock: VaultApiMock;
const onOpenChange = vi.fn();

beforeEach(() => {
  mock = createVaultApiMock({ state: 'locked' });
  installVaultApi(mock);
  vi.clearAllMocks();
});

afterEach(() => {
  expectNoNativeTitles();
  cleanup();
});

describe('ResetVaultDialog', () => {
  const resetButton = () => screen.getByRole('button', { name: 'Reset vault' });
  const confirmField = () => screen.getByLabelText(/to confirm/);

  it('needs RESET typed before it does anything, then resets and closes', async () => {
    renderWithVaultProviders(<ResetVaultDialog open onOpenChange={onOpenChange} />);
    expect(resetButton().hasAttribute('disabled')).toBe(true);
    fireEvent.change(confirmField(), { target: { value: 'reset' } });
    expect(resetButton().hasAttribute('disabled')).toBe(true);
    fireEvent.change(confirmField(), { target: { value: 'RESET' } });
    fireEvent.click(resetButton());
    await waitFor(() => expect(mock.api.reset).toHaveBeenCalled());
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Vault reset', expect.anything()),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('reports a failure and stays open', async () => {
    mock.api.reset.mockRejectedValueOnce(new Error('[vault:corrupt] disk trouble'));
    renderWithVaultProviders(<ResetVaultDialog open onOpenChange={onOpenChange} />);
    fireEvent.change(confirmField(), { target: { value: 'RESET' } });
    fireEvent.click(resetButton());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not reset the vault', {
        description: 'disk trouble',
      }),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('closes on Cancel', () => {
    renderWithVaultProviders(<ResetVaultDialog open onOpenChange={onOpenChange} />);
    fireEvent.change(confirmField(), { target: { value: 'RESET' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
