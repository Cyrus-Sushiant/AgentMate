import { beforeEach, describe, expect, it } from 'vitest';
import { confirmDialog, resolveConfirm, useConfirmStore } from './confirmStore';

function state() {
  return useConfirmStore.getState();
}

beforeEach(() => {
  useConfirmStore.setState({
    open: false,
    title: '',
    description: undefined,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    variant: 'default',
    resolve: null,
  });
});

describe('confirmDialog', () => {
  it('starts closed with the default button labels', () => {
    expect(state()).toMatchObject({ open: false, confirmLabel: 'Confirm', cancelLabel: 'Cancel' });
  });

  it('opens the modal with what it was asked to show', () => {
    void confirmDialog({
      title: 'Delete the project?',
      description: 'Its files stay on disk.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    expect(state()).toMatchObject({
      open: true,
      title: 'Delete the project?',
      description: 'Its files stay on disk.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'destructive',
    });
  });

  it('resolves true when the user confirms', async () => {
    const answer = confirmDialog({ title: 'Go on?' });
    resolveConfirm(true);
    await expect(answer).resolves.toBe(true);
    expect(state().open).toBe(false);
    expect(state().resolve).toBeNull();
  });

  it('resolves false when the user cancels', async () => {
    const answer = confirmDialog({ title: 'Go on?' });
    resolveConfirm(false);
    await expect(answer).resolves.toBe(false);
    expect(state().open).toBe(false);
  });

  it('answers no to a question that a second one replaced', async () => {
    // Two callers can ask at once; the first must not be left waiting forever.
    const first = confirmDialog({ title: 'First' });
    const second = confirmDialog({ title: 'Second' });
    await expect(first).resolves.toBe(false);
    expect(state().title).toBe('Second');
    resolveConfirm(true);
    await expect(second).resolves.toBe(true);
  });

  it('clears the labels of the previous question', () => {
    void confirmDialog({ title: 'First', confirmLabel: 'Delete', variant: 'destructive' });
    resolveConfirm(false);
    void confirmDialog({ title: 'Second' });
    expect(state()).toMatchObject({ confirmLabel: 'Confirm', variant: 'default' });
  });
});

describe('resolveConfirm', () => {
  it('does nothing when no question is waiting', () => {
    expect(() => resolveConfirm(true)).not.toThrow();
    expect(state().open).toBe(false);
  });

  it('answers only once, so a second click changes nothing', async () => {
    const answer = confirmDialog({ title: 'Go on?' });
    resolveConfirm(true);
    resolveConfirm(false);
    await expect(answer).resolves.toBe(true);
  });
});
