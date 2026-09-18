import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptHistoryEntry } from '../../../shared/apiTypes';
import { renderWithProviders } from '../../../test/renderer/renderWithProviders';

/**
 * Prompt History from the outside: what a stored entry looks like on a card, what the search box
 * asks the bridge for, and the confirm-then-delete flow. The confirmation modal itself lives in
 * the app shell rather than on this page, so the store behind it is mocked and its answer is
 * what the test controls.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    custom: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

const confirm = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('@/stores/confirmStore', () => confirm);

const { default: PromptHistoryPage } = await import('./PromptHistoryPage');

function entry(overrides: Partial<PromptHistoryEntry> = {}): PromptHistoryEntry {
  return {
    id: 'h1',
    rawInput: 'add a login form',
    promptType: 'Full Stack',
    targetAI: 'Claude',
    content: 'You are a senior engineer. Build a login form.',
    source: 'generate',
    tags: [],
    projectId: null,
    createdAt: '2026-02-01T09:00:00.000Z',
    ...overrides,
  };
}

const translation = entry({
  id: 'h2',
  rawInput: 'یک فرم ورود بساز',
  promptType: '',
  targetAI: '',
  content: 'Build a login form',
  source: 'translate',
});

/**
 * The card a given entry is drawn on, so the buttons on it can be told apart. Waits for the
 * entry, since the list arrives from the bridge a tick after the first render.
 */
async function cardFor(text: string): Promise<HTMLElement> {
  const paragraph = await screen.findByText(text);
  const card = paragraph.closest('div.glass');
  if (!card) throw new Error(`no card around "${text}"`);
  return card as HTMLElement;
}

const searchBox = (): HTMLElement => screen.getByPlaceholderText('Search prompt history…');

beforeEach(() => {
  confirm.confirmDialog.mockResolvedValue(true);
});

describe('PromptHistoryPage empty and broken states', () => {
  it('renders without data behind it and asks for nothing it cannot have', async () => {
    renderWithProviders(<PromptHistoryPage />);

    // The search box is always there, even before (or without) any history.
    expect(await screen.findByPlaceholderText('Search prompt history…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('invites you to generate something when the list comes back empty', async () => {
    renderWithProviders(<PromptHistoryPage />, { bridge: { 'promptHistory.list': [] } });

    expect(await screen.findByText('Nothing here yet')).toBeTruthy();
    expect(
      screen.getByText(
        'Generate or translate a prompt in Prompt Builder and it will show up here.',
      ),
    ).toBeTruthy();
  });

  it('explains a failed load and retries when asked', async () => {
    let attempt = 0;
    const { user } = renderWithProviders(<PromptHistoryPage />, {
      bridge: {
        'promptHistory.list': async () => {
          attempt += 1;
          if (attempt === 1) throw new Error('history database is locked');
          return [entry()];
        },
      },
    });

    expect(await screen.findByText("Couldn't load prompt history.")).toBeTruthy();
    expect(screen.getByText('history database is locked')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('You are a senior engineer. Build a login form.')).toBeTruthy();
  });
});

describe('PromptHistoryPage list', () => {
  it('shows a generated entry with its type, target and project, and a translation as such', async () => {
    renderWithProviders(<PromptHistoryPage />, {
      bridge: {
        'promptHistory.list': [entry({ projectId: 'p1', tags: ['login'] }), translation],
        'projects.list': [{ id: 'p1', name: 'Apollo' }],
      },
    });

    const generated = await cardFor('You are a senior engineer. Build a login form.');
    await waitFor(() => expect(within(generated).getByText('Apollo')).toBeTruthy());
    expect(within(generated).getByText('Full Stack')).toBeTruthy();
    expect(within(generated).getByText('Claude')).toBeTruthy();
    expect(within(generated).getByText('Generated')).toBeTruthy();
    expect(within(generated).getByText('login')).toBeTruthy();

    const translated = await cardFor('Build a login form');
    expect(within(translated).getByText('Translation')).toBeTruthy();
    expect(within(translated).getByText('Translated')).toBeTruthy();
  });

  it('opens the details of one entry, showing the input it came from', async () => {
    const { user } = renderWithProviders(<PromptHistoryPage />, {
      bridge: { 'promptHistory.list': [entry({ tags: ['login'] })] },
    });

    const card = await cardFor('You are a senior engineer. Build a login form.');
    await user.click(within(card).getByRole('button', { name: /View details/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Original input')).toBeTruthy();
    expect(within(dialog).getByText('add a login form')).toBeTruthy();
    expect(within(dialog).getByText('Generated prompt')).toBeTruthy();
    expect(within(dialog).getByText('login')).toBeTruthy();
  });

  it('copies an entry to the clipboard', async () => {
    const { user } = renderWithProviders(<PromptHistoryPage />, {
      bridge: { 'promptHistory.list': [entry()] },
    });
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    const card = await cardFor('You are a senior engineer. Build a login form.');
    await user.click(within(card).getByRole('button', { name: /Copy/ }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('You are a senior engineer. Build a login form.'),
    );
    expect(toast.success).toHaveBeenCalledWith('Copied to clipboard.');
  });
});

describe('PromptHistoryPage search', () => {
  it('searches for what is in the box and says so when nothing matches', async () => {
    const { user, bridge } = renderWithProviders(<PromptHistoryPage />, {
      bridge: {
        'promptHistory.list': [entry()],
        'promptHistory.search': async (query: unknown) =>
          query === 'login' ? [entry()] : ([] as PromptHistoryEntry[]),
      },
    });

    await screen.findByText('You are a senior engineer. Build a login form.');
    await user.type(searchBox(), 'login');

    await waitFor(() => expect(bridge.$fn('promptHistory.search')).toHaveBeenCalledWith('login'));
    expect(screen.getByText('You are a senior engineer. Build a login form.')).toBeTruthy();

    await user.clear(searchBox());
    await user.type(searchBox(), 'nope');

    expect(await screen.findByText('No matching prompts found.')).toBeTruthy();
    expect(screen.getByText('No prompts match "nope".')).toBeTruthy();
  });

  it('asks the bridge again on every keystroke, since the box is not debounced', async () => {
    // Deliberately documenting the current behaviour: no timer sits between the box and the
    // query, so three characters mean three searches. Fake timers would have nothing to advance.
    const { user, bridge } = renderWithProviders(<PromptHistoryPage />, {
      bridge: { 'promptHistory.list': [entry()], 'promptHistory.search': [] },
    });

    await screen.findByText('You are a senior engineer. Build a login form.');
    await user.type(searchBox(), 'log');

    await waitFor(() => expect(bridge.$fn('promptHistory.search')).toHaveBeenCalledWith('log'));
    expect(bridge.$fn('promptHistory.search').mock.calls).toEqual([['l'], ['lo'], ['log']]);
  });
});

describe('PromptHistoryPage delete', () => {
  it('asks before deleting and then tells the bridge, and the entry goes away', async () => {
    let entries = [entry(), entry({ id: 'h3', content: 'Another prompt' })];
    const { user, bridge } = renderWithProviders(<PromptHistoryPage />, {
      bridge: {
        'promptHistory.list': async () => entries,
        'promptHistory.remove': async (id: unknown) => {
          entries = entries.filter((one) => one.id !== id);
        },
      },
    });

    const card = await cardFor('You are a senior engineer. Build a login form.');
    await user.click(within(card).getByRole('button', { name: /Delete/ }));

    await waitFor(() => expect(bridge.$fn('promptHistory.remove')).toHaveBeenCalledWith('h1'));
    expect(confirm.confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', confirmLabel: 'Delete' }),
    );
    await waitFor(() =>
      expect(screen.queryByText('You are a senior engineer. Build a login form.')).toBeNull(),
    );
    // The other entry is untouched.
    expect(screen.getByText('Another prompt')).toBeTruthy();
  });

  it('keeps the entry when the confirmation is dismissed', async () => {
    confirm.confirmDialog.mockResolvedValueOnce(false);
    const { user, bridge } = renderWithProviders(<PromptHistoryPage />, {
      bridge: { 'promptHistory.list': [entry()] },
    });

    const card = await cardFor('You are a senior engineer. Build a login form.');
    await user.click(within(card).getByRole('button', { name: /Delete/ }));

    await waitFor(() => expect(confirm.confirmDialog).toHaveBeenCalled());
    expect(() => bridge.$fn('promptHistory.remove')).toThrow();
    expect(screen.getByText('You are a senior engineer. Build a login form.')).toBeTruthy();
  });

  it('says so when the delete fails and leaves the entry in place', async () => {
    const { user } = renderWithProviders(<PromptHistoryPage />, {
      bridge: {
        'promptHistory.list': [entry()],
        'promptHistory.remove': async () => {
          throw new Error('database is locked');
        },
      },
    });

    const card = await cardFor('You are a senior engineer. Build a login form.');
    await user.click(within(card).getByRole('button', { name: /Delete/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not delete this entry.'));
    expect(screen.getByText('You are a senior engineer. Build a login form.')).toBeTruthy();
  });
});

describe('PromptHistoryPage tags', () => {
  it('adds a tag, removes one, and complains when saving fails', async () => {
    const { user, bridge } = renderWithProviders(<PromptHistoryPage />, {
      bridge: { 'promptHistory.list': [entry({ tags: ['login'] })] },
    });

    const card = await cardFor('You are a senior engineer. Build a login form.');
    await user.click(within(card).getByRole('button', { name: /Add tag/ }));
    await user.type(within(card).getByPlaceholderText('Tag name…'), 'auth{Enter}');

    await waitFor(() =>
      expect(bridge.$fn('promptHistory.setTags')).toHaveBeenCalledWith('h1', ['login', 'auth']),
    );

    await user.click(within(card).getByRole('button', { name: 'Remove tag login' }));
    await waitFor(() =>
      expect(bridge.$fn('promptHistory.setTags')).toHaveBeenLastCalledWith('h1', []),
    );
  });

  it('reports a tag that could not be saved', async () => {
    const { user } = renderWithProviders(<PromptHistoryPage />, {
      bridge: {
        'promptHistory.list': [entry({ tags: ['login'] })],
        'promptHistory.setTags': async () => {
          throw new Error('disk full');
        },
      },
    });

    const card = await cardFor('You are a senior engineer. Build a login form.');
    await user.click(within(card).getByRole('button', { name: 'Remove tag login' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not update tags.'));
  });
});
