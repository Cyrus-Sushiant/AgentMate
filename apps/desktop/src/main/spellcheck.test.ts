import { app } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipcChannels';
import type { SpellcheckMenuPayload } from '../shared/spellcheck';
import { fakeWebContents } from '../test/main/electronMock';
import { invokeFrom } from '../test/main/ipcHarness';
import { registerSpellcheckHandlers } from './spellcheck';

type ContextMenuListener = (event: unknown, params: Record<string, unknown>) => void;

/** A window's contents that records the `context-menu` listener and what was sent to the renderer. */
function contentsThatCanBeRightClicked() {
  const listeners = new Map<string, ContextMenuListener>();
  const send = vi.fn();
  const contents = {
    on: (event: string, listener: ContextMenuListener) => listeners.set(event, listener),
    send,
  };
  app.emit('web-contents-created', {}, contents);
  return {
    send,
    rightClick: (params: Record<string, unknown>) => listeners.get('context-menu')?.({}, params),
  };
}

const ALL_ENABLED = {
  canCut: true,
  canCopy: true,
  canPaste: true,
  canSelectAll: true,
  canUndo: true,
  canRedo: false,
  canDelete: true,
  canEditRichly: false,
};

/** Contents that can be asked to cut, copy, paste and select all, like the real ones. */
function editableSender() {
  return Object.assign(fakeWebContents(), {
    cut: vi.fn(),
    copy: vi.fn(),
    paste: vi.fn(),
    selectAll: vi.fn(),
    openDevTools: vi.fn(),
  });
}

describe('the right-click menu payload', () => {
  it('carries what Chromium says can be cut, copied, pasted and selected', () => {
    registerSpellcheckHandlers();
    const window = contentsThatCanBeRightClicked();

    window.rightClick({
      isEditable: true,
      misspelledWord: '',
      dictionarySuggestions: [],
      selectionText: 'abc',
      editFlags: { ...ALL_ENABLED, canCut: false, canPaste: false },
    });

    expect(window.send).toHaveBeenCalledTimes(1);
    const [channel, payload] = window.send.mock.calls[0] as [string, SpellcheckMenuPayload];
    expect(channel).toBe(IPC.spellcheck.onShowMenu);
    expect(payload.editFlags).toEqual({
      canCut: false,
      canCopy: true,
      canPaste: false,
      canSelectAll: true,
    });
  });

  it('still carries the spelling details the writing menu needs', () => {
    registerSpellcheckHandlers();
    const window = contentsThatCanBeRightClicked();

    window.rightClick({
      isEditable: true,
      misspelledWord: 'teh',
      dictionarySuggestions: ['the', 'ten'],
      selectionText: 'teh',
      editFlags: ALL_ENABLED,
    });

    const [, payload] = window.send.mock.calls[0] as [string, SpellcheckMenuPayload];
    expect(payload).toMatchObject({
      word: 'teh',
      suggestions: ['the', 'ten'],
      selectionText: 'teh',
    });
  });

  it('stays quiet for a right-click outside any editable field', () => {
    registerSpellcheckHandlers();
    const window = contentsThatCanBeRightClicked();

    window.rightClick({ isEditable: false, editFlags: ALL_ENABLED });

    expect(window.send).not.toHaveBeenCalled();
  });
});

describe('spellcheck:runEditCommand', () => {
  it.each(['cut', 'copy', 'paste', 'selectAll'] as const)(
    'runs %s on the window that asked',
    async (command) => {
      registerSpellcheckHandlers();
      const sender = editableSender();

      const ran = await invokeFrom<boolean>(sender, IPC.spellcheck.runEditCommand, command);

      expect(ran).toBe(true);
      expect(sender[command]).toHaveBeenCalledTimes(1);
    },
  );

  it('runs only the command that was asked for', async () => {
    registerSpellcheckHandlers();
    const sender = editableSender();

    await invokeFrom(sender, IPC.spellcheck.runEditCommand, 'paste');

    expect(sender.cut).not.toHaveBeenCalled();
    expect(sender.copy).not.toHaveBeenCalled();
    expect(sender.selectAll).not.toHaveBeenCalled();
  });

  it.each([
    ['another method on the contents', 'openDevTools'],
    ['an empty string', ''],
    ['an inherited property', '__proto__'],
    ['a non-string', 42],
    ['nothing at all', undefined],
  ])('refuses %s', async (_label, command) => {
    registerSpellcheckHandlers();
    const sender = editableSender();

    const ran = await invokeFrom<boolean>(sender, IPC.spellcheck.runEditCommand, command);

    expect(ran).toBe(false);
    expect(sender.openDevTools).not.toHaveBeenCalled();
    for (const name of ['cut', 'copy', 'paste', 'selectAll'] as const) {
      expect(sender[name]).not.toHaveBeenCalled();
    }
  });
});
