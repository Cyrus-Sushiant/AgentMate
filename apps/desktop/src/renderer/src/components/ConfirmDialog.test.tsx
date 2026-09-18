import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { confirmDialog, useConfirmStore } from '@/stores/confirmStore';
import { renderWithProviders } from '../../../test/renderer/renderWithProviders';
import { ConfirmDialogHost } from './ConfirmDialog';

/**
 * Every destructive action in the app awaits confirmDialog(). What matters is that the promise
 * the caller is blocked on always settles, whichever way the question is answered, because a
 * promise left hanging means a delete that silently never happens.
 */

describe('ConfirmDialogHost', () => {
  it('stays out of the way until something asks a question', () => {
    renderWithProviders(<ConfirmDialogHost />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the question the caller asked, with its own labels', async () => {
    renderWithProviders(<ConfirmDialogHost />);

    void confirmDialog({
      title: 'Remove "Studio Mac"?',
      description: 'This forgets the saved server.\nThe machine itself is untouched.',
      confirmLabel: 'Remove',
      variant: 'destructive',
    });

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Remove "Studio Mac"?');
    expect(dialog.textContent).toContain('This forgets the saved server.');
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
    // No cancel label was given, so the default one keeps a way out.
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('resolves true and closes when the user confirms', async () => {
    const { user } = renderWithProviders(<ConfirmDialogHost />);
    const answer = confirmDialog({ title: 'Delete everything?', confirmLabel: 'Delete' });
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await expect(answer).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('resolves false when the user cancels', async () => {
    const { user } = renderWithProviders(<ConfirmDialogHost />);
    const answer = confirmDialog({ title: 'Delete everything?' });
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await expect(answer).resolves.toBe(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('treats dismissing the dialog with Escape as a no', async () => {
    const { user } = renderWithProviders(<ConfirmDialogHost />);
    const answer = confirmDialog({ title: 'Delete everything?' });
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await expect(answer).resolves.toBe(false);
  });

  it('answers a question that gets replaced before it is picked, rather than stranding its caller', async () => {
    const { user } = renderWithProviders(<ConfirmDialogHost />);
    const first = confirmDialog({ title: 'First question?' });
    await screen.findByRole('dialog');

    const second = confirmDialog({ title: 'Second question?', confirmLabel: 'Yes' });

    await expect(first).resolves.toBe(false);
    expect(await screen.findByText('Second question?')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await expect(second).resolves.toBe(true);
    // Nothing is left holding the store open for the next caller.
    expect(useConfirmStore.getState().resolve).toBeNull();
  });
});
