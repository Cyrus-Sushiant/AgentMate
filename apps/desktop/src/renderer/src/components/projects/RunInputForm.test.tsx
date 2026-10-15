import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { RunInputForm, type RunInputFormProps } from './RunInputForm';

function renderForm(command: string, props: Partial<RunInputFormProps> = {}) {
  const onRun = vi.fn();
  const onCancel = vi.fn();
  const view = renderWithProviders(
    <RunInputForm command={command} onRun={onRun} onCancel={onCancel} {...props} />,
  );
  return { ...view, onRun, onCancel };
}

describe('RunInputForm', () => {
  it('has one labelled field per input, starting from its default, with optional ones marked', () => {
    renderForm('npm run dev -- --port {{port=3000}} {{args?}}');

    expect(screen.getByRole('textbox', { name: 'Port' })).toHaveValue('3000');
    expect(screen.getByRole('textbox', { name: 'Args (optional)' })).toHaveValue('');
  });

  it('starts with the first field focused and its text selected', async () => {
    renderForm('serve --port {{port=3000}}');

    const port = screen.getByRole('textbox', { name: 'Port' }) as HTMLInputElement;
    await waitFor(() => expect(port).toHaveFocus());
    expect([port.selectionStart, port.selectionEnd]).toEqual([0, 4]);
  });

  it('previews the command, with typed values set apart from the text around them', async () => {
    const { user } = renderForm('npm run dev -- --port {{port=3000}}');
    const preview = screen.getByRole('group', { name: 'What will run' });
    expect(preview).toHaveTextContent('npm run dev -- --port 3000');

    const port = screen.getByRole('textbox', { name: 'Port' });
    await user.clear(port);
    await user.type(port, '4000');

    expect(preview).toHaveTextContent('npm run dev -- --port 4000');
    expect(within(preview).getByText('4000').tagName).toBe('BDI');
  });

  it('runs the filled command on Enter, and from the Run button', async () => {
    const { user, onRun } = renderForm('npm run dev -- --port {{port=3000}}');
    const port = screen.getByRole('textbox', { name: 'Port' });
    await user.clear(port);
    await user.type(port, '4000{Enter}');
    expect(onRun).toHaveBeenCalledWith('npm run dev -- --port 4000');

    onRun.mockClear();
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(onRun).toHaveBeenCalledWith('npm run dev -- --port 4000');
  });

  it('blocks a blank required field with an alert, and moves focus to it', async () => {
    const { user, onRun } = renderForm('serve {{port}}');
    const port = screen.getByRole('textbox', { name: 'Port' });

    await user.click(screen.getByRole('button', { name: 'Run' }));

    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Port is required.');
    expect(port).toHaveAttribute('aria-invalid', 'true');
    expect(port).toHaveFocus();
  });

  it('clears the alert once the field has something in it', async () => {
    const { user, onRun } = renderForm('serve {{port}}');
    await user.click(screen.getByRole('button', { name: 'Run' }));

    await user.type(screen.getByRole('textbox', { name: 'Port' }), '4000');

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Port' })).toHaveAttribute('aria-invalid', 'false');
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(onRun).toHaveBeenCalledWith('serve 4000');
  });

  it('runs with an optional value left empty, dropping it from the command', async () => {
    const { user, onRun } = renderForm('npm test {{args?}}');

    await user.click(screen.getByRole('button', { name: 'Run' }));

    expect(onRun).toHaveBeenCalledWith('npm test');
  });

  it('refuses to run when nothing would be left to run', async () => {
    const { user, onRun } = renderForm('{{args?}}');

    await user.click(screen.getByRole('button', { name: 'Run' }));

    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('There is nothing to run yet.');
  });

  it('puts values in as typed, spaces included and without quotes', async () => {
    const { user, onRun } = renderForm('serve {{name}}');

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'my app');
    await user.click(screen.getByRole('button', { name: 'Run' }));

    expect(onRun).toHaveBeenCalledWith('serve my app');
  });

  it('offers Cancel when there is no list to go back to', async () => {
    const { user, onCancel } = renderForm('pnpm dev {{args?}}');

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('offers Back when it came from the list, and Back does not run anything', async () => {
    const onBack = vi.fn();
    const { user, onRun } = renderForm('serve {{port=3000}}', { onBack });

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onRun).not.toHaveBeenCalled();
  });

  it('says how to run it', () => {
    renderForm('serve {{port=3000}}');

    expect(screen.getByText(/Press/)).toHaveTextContent('Press Enter to run');
  });
});
