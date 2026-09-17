import { describe, expect, it } from 'vitest';
import { isTerminalCopyKey, isTerminalPasteKey } from './terminalKeys';

function keydown(fields: {
  key: string;
  code: string;
  keyCode: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}) {
  return { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...fields };
}

describe('isTerminalPasteKey', () => {
  it('pastes on a physical Ctrl+V', () => {
    expect(
      isTerminalPasteKey(keydown({ key: 'v', code: 'KeyV', keyCode: 86, ctrlKey: true })),
    ).toBe(true);
  });

  it('pastes on Cmd+V', () => {
    expect(
      isTerminalPasteKey(keydown({ key: 'v', code: 'KeyV', keyCode: 86, metaKey: true })),
    ).toBe(true);
  });

  it('pastes on Ctrl+V typed on a Farsi layout', () => {
    expect(
      isTerminalPasteKey(keydown({ key: 'ر', code: 'KeyV', keyCode: 86, ctrlKey: true })),
    ).toBe(true);
  });

  // Recorded from Electron: Windows clipboard history sends Ctrl+V without a scan code once an
  // item is picked. On an English layout the key still reads "v", on Persian it does not.
  it('pastes on the Ctrl+V that Win+V sends, on an English layout', () => {
    expect(isTerminalPasteKey(keydown({ key: 'v', code: '', keyCode: 86, ctrlKey: true }))).toBe(
      true,
    );
  });

  it('pastes on the Ctrl+V that Win+V sends, on a Persian layout', () => {
    expect(isTerminalPasteKey(keydown({ key: 'ر', code: '', keyCode: 86, ctrlKey: true }))).toBe(
      true,
    );
  });

  it('pastes on Shift+Insert', () => {
    expect(
      isTerminalPasteKey(keydown({ key: 'Insert', code: 'Insert', keyCode: 45, shiftKey: true })),
    ).toBe(true);
    expect(
      isTerminalPasteKey(keydown({ key: 'Insert', code: '', keyCode: 45, shiftKey: true })),
    ).toBe(true);
  });

  it('leaves other keys to the shell', () => {
    // Pressing Win+V itself: only the Windows key and a key-up for V ever reach the window.
    expect(
      isTerminalPasteKey(keydown({ key: 'Meta', code: 'MetaLeft', keyCode: 91, metaKey: true })),
    ).toBe(false);
    expect(isTerminalPasteKey(keydown({ key: 'v', code: 'KeyV', keyCode: 86 }))).toBe(false);
    expect(
      isTerminalPasteKey(
        keydown({ key: 'v', code: 'KeyV', keyCode: 86, ctrlKey: true, altKey: true }),
      ),
    ).toBe(false);
    expect(isTerminalPasteKey(keydown({ key: 'ز', code: '', keyCode: 67, ctrlKey: true }))).toBe(
      false,
    );
    expect(
      isTerminalPasteKey(
        keydown({ key: 'Insert', code: 'Insert', keyCode: 45, shiftKey: true, ctrlKey: true }),
      ),
    ).toBe(false);
  });
});

describe('isTerminalCopyKey', () => {
  it('copies on Ctrl+C, including one sent without a scan code on a Persian layout', () => {
    expect(isTerminalCopyKey(keydown({ key: 'c', code: 'KeyC', keyCode: 67, ctrlKey: true }))).toBe(
      true,
    );
    expect(isTerminalCopyKey(keydown({ key: 'ز', code: '', keyCode: 67, ctrlKey: true }))).toBe(
      true,
    );
  });

  it('leaves Ctrl+Shift+C and plain C alone', () => {
    expect(
      isTerminalCopyKey(
        keydown({ key: 'C', code: 'KeyC', keyCode: 67, ctrlKey: true, shiftKey: true }),
      ),
    ).toBe(false);
    expect(isTerminalCopyKey(keydown({ key: 'c', code: 'KeyC', keyCode: 67 }))).toBe(false);
  });
});
