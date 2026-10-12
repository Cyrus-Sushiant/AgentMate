import type { SpellcheckMenuPayload } from '@shared/spellcheck';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { WritingMenuHost } from './WritingMenuHost';

const ALL_ENABLED = { canCut: true, canCopy: true, canPaste: true, canSelectAll: true };

function payload(patch: Partial<SpellcheckMenuPayload> = {}): SpellcheckMenuPayload {
  return {
    word: '',
    suggestions: [],
    selectionText: '',
    editFlags: ALL_ENABLED,
    ...patch,
  };
}

const GRAMMAR_OFF = { grammar: { enabled: false, ignoredRules: [] } };
const GRAMMAR_ON = { grammar: { enabled: true, ignoredRules: [] } };

function renderHost(
  fields: React.ReactNode,
  bridge: Record<string, unknown> = { 'settings.get': GRAMMAR_OFF },
) {
  return renderWithProviders(
    <>
      {fields}
      <WritingMenuHost />
    </>,
    { bridge },
  );
}

/** What the app does on a right-click: the DOM event first, then main reporting back. */
function rightClick(
  target: Element,
  menuPayload: SpellcheckMenuPayload,
  emit: (path: string, ...args: unknown[]) => void,
): void {
  fireEvent.contextMenu(target);
  act(() => emit('spellcheck.onShowMenu', menuPayload));
}

const item = (name: string) => screen.queryByRole('menuitem', { name });

describe('the edit section of the field menu', () => {
  it('opens on a plain, empty text box with Cut, Copy, Paste and Select all', () => {
    const { bridge } = renderHost(<input aria-label="Project name" />);

    rightClick(screen.getByLabelText('Project name'), payload(), bridge.$emit);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((one) => one.textContent)).toEqual([
      expect.stringContaining('Cut'),
      expect.stringContaining('Copy'),
      expect.stringContaining('Paste'),
      expect.stringContaining('Select all'),
    ]);
  });

  it.each([
    ['a textarea (the commit message)', <textarea key="a" aria-label="Field" />],
    ['a search box', <input key="b" type="search" aria-label="Field" />],
    ['a number box', <input key="c" type="number" aria-label="Field" />],
    ['an email box', <input key="d" type="email" aria-label="Field" />],
    ['a password box', <input key="e" type="password" aria-label="Field" />],
  ])('opens on %s', (_label, field) => {
    const { bridge } = renderHost(field);

    rightClick(screen.getByLabelText('Field'), payload(), bridge.$emit);

    expect(item('Paste')).toBeInTheDocument();
  });

  it('shows nothing about writing when there is nothing to say about it', () => {
    const { bridge } = renderHost(<input aria-label="Name" defaultValue="hello" />);

    rightClick(screen.getByLabelText('Name'), payload(), bridge.$emit);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.queryByText('Writing check')).not.toBeInTheDocument();
    expect(screen.queryByText('No writing issues here')).not.toBeInTheDocument();
  });

  it.each([
    ['xterm keeps for the terminal', 'xterm', ''],
    ['Monaco keeps for the code editor', 'monaco-editor', 'inputarea'],
  ])('leaves alone the hidden textarea %s', (_label, wrapperClass, fieldClass) => {
    const { bridge } = renderHost(
      <div className={wrapperClass}>
        <textarea aria-label="Hidden" className={fieldClass} />
      </div>,
    );

    rightClick(screen.getByLabelText('Hidden'), payload(), bridge.$emit);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not take over the inputs inside Monaco that are ordinary boxes', () => {
    // The find box lives in the editor too, and it has no menu of its own.
    const { bridge } = renderHost(
      <div className="monaco-editor">
        <textarea aria-label="Find" />
      </div>,
    );

    rightClick(screen.getByLabelText('Find'), payload(), bridge.$emit);

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it.each([
    ['a read-only box', <input key="r" readOnly data-testid="target" />],
    ['a checkbox', <input key="c" type="checkbox" data-testid="target" />],
    [
      'plain text',
      <p key="p" data-testid="target">
        Not a field
      </p>,
    ],
  ])('stays closed on %s', (_label, field) => {
    const { bridge } = renderHost(field);

    rightClick(screen.getByTestId('target'), payload(), bridge.$emit);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens once for a field and not for the one right-clicked after it', () => {
    // The menu belongs to the click that made it: a later click on something else closes it.
    const { bridge } = renderHost(
      <>
        <input aria-label="Name" />
        <p>Some text</p>
      </>,
    );
    rightClick(screen.getByLabelText('Name'), payload(), bridge.$emit);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText('Some text'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('disables what the field cannot do right now', () => {
    const { bridge } = renderHost(<input aria-label="Name" />);

    rightClick(
      screen.getByLabelText('Name'),
      payload({ editFlags: { ...ALL_ENABLED, canCut: false, canCopy: false, canPaste: false } }),
      bridge.$emit,
    );

    expect(item('Cut')).toBeDisabled();
    expect(item('Copy')).toBeDisabled();
    expect(item('Paste')).toBeDisabled();
    expect(item('Select all')).toBeEnabled();
  });

  it.each([
    ['win32', 'Ctrl+X', 'Ctrl+A'],
    ['linux', 'Ctrl+X', 'Ctrl+A'],
    ['darwin', '⌘X', '⌘A'],
  ])('shows the keys the way %s writes them', (platform, cut, selectAll) => {
    const { bridge } = renderHost(<input aria-label="Name" />, {
      'settings.get': GRAMMAR_OFF,
      platform,
    });

    rightClick(screen.getByLabelText('Name'), payload(), bridge.$emit);

    expect(item('Cut')).toHaveTextContent(cut);
    expect(item('Select all')).toHaveTextContent(selectAll);
  });
});

describe('running a command', () => {
  it.each([
    ['Cut', 'cut'],
    ['Copy', 'copy'],
    ['Paste', 'paste'],
    ['Select all', 'selectAll'],
  ])('%s asks main to run %s and closes the menu', async (label, command) => {
    const { bridge, user } = renderHost(<input aria-label="Name" />);
    rightClick(screen.getByLabelText('Name'), payload(), bridge.$emit);

    await user.click(item(label) as HTMLElement);

    expect(bridge.$fn('spellcheck.runEditCommand')).toHaveBeenCalledWith(command);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does nothing when a disabled command is clicked', async () => {
    const { bridge, user } = renderHost(<input aria-label="Name" />);
    rightClick(
      screen.getByLabelText('Name'),
      payload({ editFlags: { ...ALL_ENABLED, canPaste: false } }),
      bridge.$emit,
    );

    await user.click(item('Paste') as HTMLElement);

    expect(() => bridge.$fn('spellcheck.runEditCommand')).toThrow();
  });

  it('keeps the caret and focus in the box while the menu is used', async () => {
    const { bridge, user } = renderHost(<input aria-label="Name" defaultValue="hello" />);
    const field = screen.getByLabelText<HTMLInputElement>('Name');
    field.focus();
    field.setSelectionRange(1, 3);
    rightClick(field, payload(), bridge.$emit);

    await user.click(item('Copy') as HTMLElement);

    expect(field).toHaveFocus();
    expect([field.selectionStart, field.selectionEnd]).toEqual([1, 3]);
  });
});

describe('closing and the keyboard', () => {
  it('closes on Escape', () => {
    const { bridge } = renderHost(<input aria-label="Name" />);
    rightClick(screen.getByLabelText('Name'), payload(), bridge.$emit);

    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps Escape from reaching a dialog the field sits in', () => {
    // A Radix dialog listens for Escape on the document from before the menu opens. Escape
    // should put away the menu only, or whatever was typed in the dialog goes with it.
    const dialogHeardEscape = vi.fn();
    document.addEventListener('keydown', dialogHeardEscape, true);
    const { bridge } = renderHost(<input aria-label="Name" />);
    rightClick(screen.getByLabelText('Name'), payload(), bridge.$emit);

    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' });

    document.removeEventListener('keydown', dialogHeardEscape, true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(dialogHeardEscape).not.toHaveBeenCalled();
  });

  it('leaves Escape alone when no menu is open', () => {
    const dialogHeardEscape = vi.fn();
    document.addEventListener('keydown', dialogHeardEscape, true);
    renderHost(<input aria-label="Name" />);

    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' });

    document.removeEventListener('keydown', dialogHeardEscape, true);
    expect(dialogHeardEscape).toHaveBeenCalledTimes(1);
  });

  it('closes on a click anywhere else', () => {
    const { bridge } = renderHost(
      <>
        <input aria-label="Name" />
        <button type="button">Elsewhere</button>
      </>,
    );
    rightClick(screen.getByLabelText('Name'), payload(), bridge.$emit);

    fireEvent.mouseDown(screen.getByText('Elsewhere'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('highlights nothing at first, so Enter and Tab do not run a command by surprise', async () => {
    const { bridge } = renderHost(<input aria-label="Name" />);
    rightClick(screen.getByLabelText('Name'), payload(), bridge.$emit);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(document.querySelector('[data-highlighted]')).toBeNull();
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(() => bridge.$fn('spellcheck.runEditCommand')).toThrow();
  });

  it('moves down through the commands that are available and runs the one it is on', () => {
    const { bridge } = renderHost(<input aria-label="Name" />);
    rightClick(
      screen.getByLabelText('Name'),
      payload({ editFlags: { ...ALL_ENABLED, canCut: false } }),
      bridge.$emit,
    );
    const field = screen.getByLabelText('Name');

    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(item('Copy')).toHaveAttribute('data-highlighted');

    // Cut is disabled and sits above Copy, so going up from Copy wraps to the end.
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(item('Select all')).toHaveAttribute('data-highlighted');

    fireEvent.keyDown(field, { key: 'ArrowUp' });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(bridge.$fn('spellcheck.runEditCommand')).toHaveBeenCalledWith('paste');
  });

  it('starts from the last command when the first key is ArrowUp', () => {
    const { bridge } = renderHost(<input aria-label="Name" />);
    rightClick(screen.getByLabelText('Name'), payload(), bridge.$emit);

    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'ArrowUp' });

    expect(item('Select all')).toHaveAttribute('data-highlighted');
  });
});

describe('next to the writing suggestions', () => {
  const MISSPELLED = payload({ word: 'teh', suggestions: ['the', 'ten'], selectionText: 'teh' });

  function renderMisspelled() {
    const view = renderHost(<textarea aria-label="Notes" defaultValue="teh cat" />);
    const field = screen.getByLabelText<HTMLTextAreaElement>('Notes');
    field.focus();
    field.setSelectionRange(0, 3);
    rightClick(field, MISSPELLED, view.bridge.$emit);
    return { ...view, field };
  }

  it('puts the suggestions first and the edit commands after them', () => {
    renderMisspelled();

    expect(screen.getAllByRole('menuitem').map((one) => one.textContent)).toEqual([
      'the',
      'ten',
      expect.stringContaining('Add to dictionary'),
      expect.stringContaining('Cut'),
      expect.stringContaining('Copy'),
      expect.stringContaining('Paste'),
      expect.stringContaining('Select all'),
    ]);
  });

  it('still highlights the first suggestion and applies it on Enter', () => {
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    const { field } = renderMisspelled();

    expect(item('the')).toHaveAttribute('data-highlighted');
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'the');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('the grammar check', () => {
  it('does not run on an empty box, even with grammar on', async () => {
    const { bridge, queryClient } = renderHost(<input aria-label="Name" />, {
      'settings.get': GRAMMAR_ON,
    });
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.settings)).toBeDefined());

    rightClick(screen.getByLabelText('Name'), payload(), bridge.$emit);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(() => bridge.$fn('grammar.check')).toThrow();
    expect(screen.queryByText('Checking writing…')).not.toBeInTheDocument();
    expect(item('Check writing again')).not.toBeInTheDocument();
  });

  it('still runs on a box with text, and the edit commands are there either way', async () => {
    const { bridge, queryClient } = renderHost(
      <input aria-label="Name" defaultValue="Some text here" />,
      { 'settings.get': GRAMMAR_ON, 'grammar.check': { issues: [] } },
    );
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.settings)).toBeDefined());

    rightClick(screen.getByLabelText('Name'), payload(), bridge.$emit);

    // A clean check leaves the "check again" button where the issues would have been.
    expect(
      await screen.findByRole('menuitem', { name: 'Check writing again' }),
    ).toBeInTheDocument();
    expect(bridge.$fn('grammar.check')).toHaveBeenCalledTimes(1);
    expect(item('Copy')).toBeInTheDocument();
  });
});
