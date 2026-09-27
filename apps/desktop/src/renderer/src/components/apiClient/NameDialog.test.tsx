import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { NameDialog } from './NameDialog';

function setup(onSubmit = vi.fn(async () => undefined)) {
  const onOpenChange = vi.fn();
  const view = renderWithProviders(
    <NameDialog
      open
      onOpenChange={onOpenChange}
      title="Rename collection"
      label="Collection name"
      initialValue="Old"
      confirmLabel="Rename"
      onSubmit={onSubmit}
    />,
  );
  return { ...view, onSubmit, onOpenChange };
}

describe('NameDialog', () => {
  it('submits the trimmed name and closes', async () => {
    const { user, onSubmit, onOpenChange } = setup();
    const input = screen.getByRole('textbox', { name: 'Collection name' });
    await user.clear(input);
    await user.type(input, '  New name {enter}');
    expect(onSubmit).toHaveBeenCalledWith('New name');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('will not submit an empty name', async () => {
    const { user } = setup();
    await user.clear(screen.getByRole('textbox', { name: 'Collection name' }));
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  it('shows the error when submitting fails', async () => {
    const { user, onOpenChange } = setup(
      vi.fn(async () => {
        throw new Error('Name taken');
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name taken');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
