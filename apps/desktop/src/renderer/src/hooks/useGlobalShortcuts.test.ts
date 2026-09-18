import { act } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchStore } from '@/stores/searchStore';
import { useShortcutStore } from '@/stores/shortcutStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { installAgentmatBridge } from '../../../test/renderer/agentmatBridge';
import { renderHookWithProviders } from '../../../test/renderer/renderWithProviders';

/**
 * The workspace commands reach into the pane tree, the launcher and the terminal store, none of
 * which the shortcut handler itself is responsible for. Mocking them keeps these tests about the
 * dispatch: which command a keypress picks, and when the handler is supposed to stay out of it.
 */
const workspace = vi.hoisted(() => ({
  isWorkspacePath: (pathname: string) =>
    pathname === '/workspace' || pathname.startsWith('/workspace/'),
  workspaceCommands: {
    openLauncher: vi.fn(),
    newShell: vi.fn(),
    closeActiveTab: vi.fn(),
    split: vi.fn(),
    focusPane: vi.fn(),
    cycleTab: vi.fn(),
    goToTab: vi.fn(),
    toggleZoom: vi.fn(),
    focusedTabIsDiff: vi.fn(() => false),
    diffChange: vi.fn(),
    toggleGitPanel: vi.fn(),
  },
}));
vi.mock('@/lib/workspace/commands', () => workspace);

const { useGlobalShortcuts } = await import('./useGlobalShortcuts');

interface KeyOptions {
  code: string;
  key?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  target?: EventTarget;
  defaultPrevented?: boolean;
}

/** Dispatches a keydown the way the browser would, and reports whether it was handled. */
function press(options: KeyOptions): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code: options.code,
    key: options.key ?? options.code.replace(/^Key/, '').toLowerCase(),
    ctrlKey: options.ctrl ?? false,
    metaKey: options.meta ?? false,
    shiftKey: options.shift ?? false,
    altKey: options.alt ?? false,
    bubbles: true,
    cancelable: true,
  });
  if (options.defaultPrevented) event.preventDefault();
  act(() => {
    (options.target ?? window).dispatchEvent(event);
  });
  return event;
}

/** The hook plus the current path, so a navigating shortcut can be observed. */
function renderShortcuts(route = '/') {
  return renderHookWithProviders(
    () => {
      useGlobalShortcuts();
      return useLocation().pathname;
    },
    { route },
  );
}

beforeEach(() => {
  useShortcutStore.setState({ overrides: {} });
  useSearchStore.setState({ open: false });
  for (const command of Object.values(workspace.workspaceCommands)) command.mockClear();
  workspace.workspaceCommands.focusedTabIsDiff.mockReturnValue(false);
});

describe('useGlobalShortcuts', () => {
  it('opens the command palette on Ctrl+K', () => {
    renderShortcuts();
    const event = press({ code: 'KeyK', ctrl: true });
    expect(useSearchStore.getState().open).toBe(true);
    // The handler owns the combination, so the browser must not also act on it.
    expect(event.defaultPrevented).toBe(true);
  });

  // The app treats Ctrl and Command as the same key, so a mac user's Cmd+K has to work too.
  it('accepts Command in place of Ctrl', () => {
    installAgentmatBridge({ platform: 'darwin' });
    renderShortcuts();
    press({ code: 'KeyK', meta: true });
    expect(useSearchStore.getState().open).toBe(true);
  });

  it('leaves a bare keypress alone', () => {
    renderShortcuts();
    const event = press({ code: 'KeyK' });
    expect(useSearchStore.getState().open).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it('matches the letter a remapped layout produced, not only the physical key', () => {
    renderShortcuts();
    // Dvorak reports a different code for the key that types "k".
    press({ code: 'KeyV', key: 'k', ctrl: true });
    expect(useSearchStore.getState().open).toBe(true);
  });

  it('toggles the terminal drawer on Ctrl+T', () => {
    renderShortcuts();
    expect(useTerminalStore.getState().isOpen).toBe(false);
    press({ code: 'KeyT', ctrl: true });
    expect(useTerminalStore.getState().isOpen).toBe(true);
    press({ code: 'KeyT', ctrl: true });
    expect(useTerminalStore.getState().isOpen).toBe(false);
  });

  it('navigates to Projects on Ctrl+P', () => {
    const { result } = renderShortcuts('/settings');
    press({ code: 'KeyP', ctrl: true });
    expect(result.current).toBe('/projects');
  });

  // A dialog binds its keys through React further down the tree, so it gets there first and
  // calls preventDefault. That has to park this handler, which is what gives the modal the say.
  it('stands down for an event a dialog already handled', () => {
    renderShortcuts();
    press({ code: 'KeyK', ctrl: true, defaultPrevented: true });
    expect(useSearchStore.getState().open).toBe(false);
  });

  it('refuses to route away from under an open dialog', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'open');
    document.body.append(dialog);

    const { result } = renderShortcuts('/settings');
    press({ code: 'KeyP', ctrl: true });
    expect(result.current).toBe('/settings');

    // The palette is not on the blocked list, so it still works with the dialog up.
    press({ code: 'KeyK', ctrl: true });
    expect(useSearchStore.getState().open).toBe(true);
    dialog.remove();
  });

  it('ignores a plain letter binding while the user is typing into a field', () => {
    // Only a user-chosen binding can be modifier-free, so the test has to set one up. A function
    // key would still be allowed through here, since it cannot be mistaken for typing.
    useShortcutStore.setState({ overrides: { 'search.toggle': [{ code: 'KeyJ' }] } });
    renderShortcuts();

    const input = document.createElement('input');
    document.body.append(input);
    press({ code: 'KeyJ', key: 'j', target: input });
    expect(useSearchStore.getState().open).toBe(false);

    // The same key outside a text field is fine.
    press({ code: 'KeyJ', key: 'j' });
    expect(useSearchStore.getState().open).toBe(true);
    input.remove();
  });

  it('ignores a plain letter binding inside a contenteditable box as well', () => {
    useShortcutStore.setState({ overrides: { 'search.toggle': [{ code: 'KeyJ' }] } });
    renderShortcuts();

    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    // jsdom does not derive isContentEditable from the attribute, so state it outright.
    Object.defineProperty(editor, 'isContentEditable', { value: true });
    document.body.append(editor);

    press({ code: 'KeyJ', key: 'j', target: editor });
    expect(useSearchStore.getState().open).toBe(false);
    editor.remove();
  });

  it('still runs a function-key binding inside a field, where it cannot be typing', () => {
    useShortcutStore.setState({ overrides: { 'search.toggle': [{ code: 'F4' }] } });
    renderShortcuts();

    const input = document.createElement('input');
    document.body.append(input);
    press({ code: 'F4', key: 'F4', target: input });
    expect(useSearchStore.getState().open).toBe(true);
    input.remove();
  });

  it('still fires a modifier binding while the user is typing', () => {
    renderShortcuts();
    const input = document.createElement('input');
    document.body.append(input);
    press({ code: 'KeyK', ctrl: true, target: input });
    expect(useSearchStore.getState().open).toBe(true);
    input.remove();
  });

  it('honours a binding the user changed', () => {
    useShortcutStore.setState({ overrides: { 'search.toggle': [{ code: 'KeyJ', mod: true }] } });
    renderShortcuts();

    press({ code: 'KeyK', ctrl: true });
    expect(useSearchStore.getState().open).toBe(false);

    press({ code: 'KeyJ', key: 'j', ctrl: true });
    expect(useSearchStore.getState().open).toBe(true);
  });

  it('runs the workspace commands only on the workspace route', () => {
    const off = renderShortcuts('/projects');
    press({ code: 'KeyT', ctrl: true, shift: true });
    expect(workspace.workspaceCommands.openLauncher).not.toHaveBeenCalled();
    off.unmount();

    renderShortcuts('/workspace/p1');
    press({ code: 'KeyT', ctrl: true, shift: true });
    expect(workspace.workspaceCommands.openLauncher).toHaveBeenCalled();
  });

  it('passes the pressed number along to the go-to-tab command', () => {
    renderShortcuts('/workspace');
    press({ code: 'Digit3', key: '3', ctrl: true });
    expect(workspace.workspaceCommands.goToTab).toHaveBeenCalledWith(3);
  });

  // F7 steps through a diff, but on a terminal tab it should fall through untouched.
  it('only moves between diff changes when the focused tab is a diff', () => {
    renderShortcuts('/workspace');
    press({ code: 'F7', key: 'F7' });
    expect(workspace.workspaceCommands.diffChange).not.toHaveBeenCalled();

    workspace.workspaceCommands.focusedTabIsDiff.mockReturnValue(true);
    press({ code: 'F7', key: 'F7' });
    expect(workspace.workspaceCommands.diffChange).toHaveBeenCalledWith('next');
  });

  it('stops listening once the shell unmounts', () => {
    const { unmount } = renderShortcuts();
    unmount();
    press({ code: 'KeyK', ctrl: true });
    expect(useSearchStore.getState().open).toBe(false);
  });
});
