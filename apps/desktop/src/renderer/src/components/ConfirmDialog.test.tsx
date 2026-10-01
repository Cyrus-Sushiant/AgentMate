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

  it('lists the items in question, how many were left out, and any warning', async () => {
    renderWithProviders(<ConfirmDialogHost />);

    void confirmDialog({
      title: 'Delete 3 items?',
      items: [
        { name: 'docs', isDirectory: true },
        { name: 'notes.md', detail: 'src/lib' },
      ],
      moreCount: 1,
      warning: 'One open file has unsaved changes that will be lost.',
      variant: 'destructive',
    });

    const dialog = await screen.findByRole('dialog');
    const rows = Array.from(dialog.querySelectorAll('li')).map((row) => row.textContent);
    expect(rows).toEqual(['docs', 'notes.mdsrc/lib', 'and 1 more']);
    expect(dialog.textContent).toContain('unsaved changes that will be lost');
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

  it('keeps the confirm button off until the asked-for text is typed, for the most destructive questions', async () => {
    const { user } = renderWithProviders(<ConfirmDialogHost />);
    const answer = confirmDialog({
      title: 'Remove sam?',
      confirmLabel: 'Remove user',
      variant: 'destructive',
      typeToConfirm: 'sam',
    });
    await screen.findByRole('dialog');
    const confirm = screen.getByRole('button', { name: 'Remove user' }) as HTMLButtonElement;

    expect(confirm.disabled).toBe(true);
    await user.type(screen.getByLabelText('Type sam to confirm'), 'Sam');
    expect(confirm.disabled).toBe(true);
    await user.clear(screen.getByLabelText('Type sam to confirm'));
    await user.type(screen.getByLabelText('Type sam to confirm'), 'sam');
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    await expect(answer).resolves.toBe(true);
  });

  it('starts every typed question empty, whatever was typed for the one before', async () => {
    const { user } = renderWithProviders(<ConfirmDialogHost />);
    void confirmDialog({ title: 'Remove sam?', typeToConfirm: 'sam' });
    await user.type(await screen.findByLabelText('Type sam to confirm'), 'sam');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    void confirmDialog({ title: 'Remove sam?', typeToConfirm: 'sam', confirmLabel: 'Remove' });

    expect(((await screen.findByLabelText('Type sam to confirm')) as HTMLInputElement).value).toBe(
      '',
    );
    expect((screen.getByRole('button', { name: 'Remove' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
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
