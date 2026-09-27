import type { ApiCollectionSummary } from '@shared/apiClientTypes';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { SaveRequestDialog } from './SaveRequestDialog';

const collections: ApiCollectionSummary[] = [
  {
    id: 'c1',
    name: 'Users API',
    requestCount: 1,
    projectIds: [],
    updatedAt: 0,
    error: null,
    tree: [
      {
        id: 'f1',
        name: 'Admin',
        kind: 'folder',
        children: [{ id: 'f2', name: 'Roles', kind: 'folder', children: [] }],
      },
      { id: 'r1', name: 'List', kind: 'request', method: 'GET' },
    ],
  },
  {
    id: 'c2',
    name: 'Billing',
    requestCount: 0,
    projectIds: [],
    updatedAt: 0,
    error: null,
    tree: [],
  },
];

function open(props: Partial<React.ComponentProps<typeof SaveRequestDialog>> = {}) {
  const onSave = vi.fn(async () => undefined);
  const onOpenChange = vi.fn();
  const view = renderWithProviders(
    <SaveRequestDialog
      open
      onOpenChange={onOpenChange}
      initialName="Get users"
      collections={collections}
      onSave={onSave}
      {...props}
    />,
  );
  return { ...view, onSave, onOpenChange };
}

describe('SaveRequestDialog', () => {
  it('saves into the chosen folder under the typed name', async () => {
    const { user, onSave, onOpenChange } = open();
    const name = screen.getByRole('textbox', { name: 'Request name' });
    expect(name).toHaveValue('Get users');
    await user.clear(name);
    await user.type(name, 'List roles');

    await user.click(screen.getByRole('option', { name: /Roles/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({ collectionId: 'c1', parentId: 'f2' }, 'List roles');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('lists folders but not requests as places to save', () => {
    open();
    expect(screen.getByRole('option', { name: /Admin/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /List/ })).not.toBeInTheDocument();
  });

  it('starts on the first collection and needs a name', async () => {
    const { user, onSave } = open();
    expect(screen.getByRole('option', { name: /Users API/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.clear(screen.getByRole('textbox', { name: 'Request name' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('creates a collection when there is none yet', async () => {
    const { user, onSave } = open({ collections: [] });
    const newName = screen.getByRole('textbox', { name: 'New collection name' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(newName, 'My API');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      { newCollectionName: 'My API', parentId: null },
      'Get users',
    );
  });

  it('can save into a new collection even when others exist', async () => {
    const { user, onSave } = open();
    await user.click(screen.getByRole('button', { name: /new collection/i }));
    await user.type(screen.getByRole('textbox', { name: 'New collection name' }), 'Fresh');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      { newCollectionName: 'Fresh', parentId: null },
      'Get users',
    );
  });

  it('shows why a save failed and stays open', async () => {
    const { user, onOpenChange } = open({
      onSave: vi.fn(async () => {
        throw new Error('Disk full');
      }),
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Disk full')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
