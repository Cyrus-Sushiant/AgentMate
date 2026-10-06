import type { ApiCollectionSummary } from '@shared/apiClientTypes';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { CollectionsSidebar } from './CollectionsSidebar';

const collections: ApiCollectionSummary[] = [
  {
    id: 'c1',
    name: 'Users API',
    requestCount: 2,
    projectIds: [],
    updatedAt: 0,
    error: null,
    tree: [
      {
        id: 'f1',
        name: 'Admin',
        kind: 'folder',
        children: [{ id: 'r2', name: 'Delete user', kind: 'request', method: 'DELETE' }],
      },
      { id: 'r1', name: 'List users', kind: 'request', method: 'GET' },
    ],
  },
  {
    id: 'c2',
    name: 'Broken',
    requestCount: 0,
    projectIds: [],
    updatedAt: 0,
    error: 'The collection file could not be read.',
    tree: [],
  },
];

function setup(props: Partial<React.ComponentProps<typeof CollectionsSidebar>> = {}) {
  const handlers = {
    onOpenRequest: vi.fn(),
    onNewCollection: vi.fn(),
    onNewRequest: vi.fn(),
    onNewFolder: vi.fn(),
    onRenameCollection: vi.fn(),
    onDeleteCollection: vi.fn(),
    onDeleteItem: vi.fn(),
  };
  const view = renderWithProviders(
    <CollectionsSidebar
      collections={collections}
      loading={false}
      activeItem={null}
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers };
}

describe('CollectionsSidebar', () => {
  it('shimmers while collections load', () => {
    setup({ loading: true, collections: [] });
    expect(screen.getByRole('status', { name: /loading collections/i })).toBeInTheDocument();
  });

  it('offers to create the first collection', async () => {
    const { user, onNewCollection } = setup({ collections: [] });
    expect(screen.getByText(/no collections yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /create a collection/i }));
    expect(onNewCollection).toHaveBeenCalled();
  });

  it('expands a collection and opens a request from it', async () => {
    const { user, onOpenRequest } = setup();
    expect(screen.queryByRole('treeitem', { name: /List users/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('treeitem', { name: /Users API/ }));
    await user.click(screen.getByRole('treeitem', { name: /List users/ }));
    expect(onOpenRequest).toHaveBeenCalledWith('c1', 'r1');

    await user.click(screen.getByRole('treeitem', { name: /Admin/ }));
    expect(screen.getByRole('treeitem', { name: /DEL Delete user/ })).toBeInTheDocument();
  });

  it('filters by name and opens the folders on the way to a match', async () => {
    const { user } = setup();
    await user.type(screen.getByRole('searchbox', { name: /filter/i }), 'delete');
    expect(screen.getByRole('treeitem', { name: /Delete user/ })).toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: /List users/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: /Broken/ })).not.toBeInTheDocument();
  });

  it('clears the filter from its clear button', async () => {
    const { user } = setup();
    const filter = screen.getByRole('searchbox', { name: /filter/i });
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();

    await user.type(filter, 'zzz');
    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(filter).toHaveValue('');
    expect(screen.getByRole('treeitem', { name: /Users API/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();
  });

  it('clears the filter on Escape', async () => {
    const { user } = setup();
    const filter = screen.getByRole('searchbox', { name: /filter/i });
    await user.type(filter, 'zzz{Escape}');
    expect(filter).toHaveValue('');
    expect(screen.getByRole('treeitem', { name: /Users API/ })).toBeInTheDocument();
  });

  it('leaves the filter out while there is nothing to filter', () => {
    setup({ collections: [] });
    expect(screen.queryByRole('searchbox', { name: /filter/i })).not.toBeInTheDocument();
  });

  it('collapses everything from the header once something is open', async () => {
    const { user } = setup();
    expect(screen.queryByRole('button', { name: 'Collapse all' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('treeitem', { name: /Users API/ }));
    await user.click(screen.getByRole('treeitem', { name: /Admin/ }));
    expect(screen.getByRole('treeitem', { name: /Delete user/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByRole('treeitem', { name: /List users/ })).not.toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: /Users API/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('button', { name: 'Collapse all' })).not.toBeInTheDocument();
  });

  it('offers to add the first request to an empty collection', async () => {
    const empty: ApiCollectionSummary = { ...collections[0], id: 'c3', name: 'Empty', tree: [] };
    const { user, onNewRequest } = setup({ collections: [empty] });
    await user.click(screen.getByRole('treeitem', { name: /Empty/ }));
    await user.click(screen.getByRole('button', { name: 'Add a request' }));
    expect(onNewRequest).toHaveBeenCalledWith('c3', null);
  });

  it('says when nothing matches the filter', async () => {
    const { user } = setup();
    await user.type(screen.getByRole('searchbox', { name: /filter/i }), 'zzz');
    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
  });

  it('highlights the request open in the active tab', async () => {
    const { user } = setup({ activeItem: { collectionId: 'c1', itemId: 'r1' } });
    await user.click(screen.getByRole('treeitem', { name: /Users API/ }));
    expect(screen.getByRole('treeitem', { name: /List users/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('runs collection actions from its menu', async () => {
    const { user, onRenameCollection, onNewRequest, onDeleteCollection } = setup();
    await user.click(screen.getByRole('button', { name: 'Actions for Users API' }));
    await user.click(await screen.findByRole('menuitem', { name: /add request/i }));
    expect(onNewRequest).toHaveBeenCalledWith('c1', null);

    await user.click(screen.getByRole('button', { name: 'Actions for Users API' }));
    await user.click(await screen.findByRole('menuitem', { name: /rename/i }));
    expect(onRenameCollection).toHaveBeenCalledWith(collections[0]);

    await user.click(screen.getByRole('button', { name: 'Actions for Users API' }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDeleteCollection).toHaveBeenCalledWith(collections[0]);
  });

  it('deletes a request from its menu', async () => {
    const { user, onDeleteItem } = setup();
    await user.click(screen.getByRole('treeitem', { name: /Users API/ }));
    await user.click(screen.getByRole('button', { name: 'Actions for List users' }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDeleteItem).toHaveBeenCalledWith('c1', expect.objectContaining({ id: 'r1' }));
  });

  it('marks a collection whose file could not be read', () => {
    setup();
    expect(screen.getByRole('treeitem', { name: /Broken/ })).toHaveAttribute('data-broken', 'true');
  });
});
