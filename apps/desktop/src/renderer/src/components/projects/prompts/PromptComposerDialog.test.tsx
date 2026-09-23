import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { type ComposerInitial, PromptComposerDialog } from './PromptComposerDialog';

/**
 * A draft needs nothing but text. A scheduled prompt also says how it runs, and an automatic
 * one needs a time that hasn't passed yet, or it would be marked missed the moment it's saved.
 */

function renderDialog(initial: ComposerInitial, lockKind = false) {
  const onSubmit = vi.fn();
  const view = renderWithProviders(
    <PromptComposerDialog
      open
      title="New prompt"
      initial={initial}
      lockKind={lockKind}
      pending={false}
      onClose={() => undefined}
      onSubmit={onSubmit}
    />,
    { bridge: { 'cli.detectAll': [{ id: 'claude-code', installed: true }] } },
  );
  return { ...view, onSubmit };
}

describe('PromptComposerDialog', () => {
  it('saves a draft with just its text', async () => {
    const { user, onSubmit } = renderDialog({ kind: 'draft' });

    expect(screen.queryByRole('radiogroup', { name: 'Run' })).toBeNull();
    const save = screen.getByRole('button', { name: /Save draft/ });
    expect(save.hasAttribute('disabled')).toBe(true);

    await user.type(screen.getByLabelText('Prompt'), '  add a logout button  ');
    await user.click(save);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'draft', text: 'add a logout button' }),
    );
  });

  it('switches a new prompt to scheduled and runs it manually by default', async () => {
    const { user, onSubmit } = renderDialog({ kind: 'draft' });

    await user.click(screen.getByRole('radio', { name: /Scheduled/ }));
    expect(screen.getByRole('radio', { name: /Manually/, checked: true })).toBeTruthy();
    expect(screen.queryByLabelText('Run at')).toBeNull();

    await user.type(screen.getByLabelText('Prompt'), 'run the tests');
    await user.click(screen.getByRole('button', { name: /^Schedule$/ }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'scheduled', runMode: 'manual', run: {} }),
    );
  });

  it('asks for a future time when it runs automatically', async () => {
    const { user, onSubmit } = renderDialog({ kind: 'scheduled', text: 'nightly cleanup' }, true);

    expect(screen.queryByRole('radiogroup', { name: 'Save as' })).toBeNull();
    await user.click(screen.getByRole('radio', { name: /Automatically/ }));

    const runAt = screen.getByLabelText('Run at') as HTMLInputElement;
    expect(runAt.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(screen.getByText(/^Runs in/)).toBeTruthy();

    await user.clear(runAt);
    await user.type(runAt, '2020-01-01T09:00');
    expect(screen.getByText('That time has already passed.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Schedule$/ }).hasAttribute('disabled')).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the CLI, model and effort it was opened with', async () => {
    const { user, onSubmit } = renderDialog(
      {
        kind: 'scheduled',
        text: 'refactor auth',
        runMode: 'manual',
        run: { cliId: 'claude-code', model: 'opus', effort: 'high' },
      },
      true,
    );

    // Opus takes every effort level, so High stays selected and enabled.
    expect(screen.getByRole('radio', { name: 'High', checked: true })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Schedule$/ }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        run: { cliId: 'claude-code', model: 'opus', effort: 'high' },
      }),
    );
  });

  it('disables effort levels the chosen model cannot use', () => {
    renderDialog(
      { kind: 'scheduled', text: 'quick fix', run: { cliId: 'claude-code', model: 'haiku' } },
      true,
    );

    expect(screen.getByRole('radio', { name: 'High' }).hasAttribute('disabled')).toBe(true);
  });
});
