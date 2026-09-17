import { isShortcutLetter } from '@/lib/shortcutKey';

type KeyEventLike = Pick<
  KeyboardEvent,
  'code' | 'key' | 'keyCode' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
>;

/**
 * Ctrl/Cmd+V or Shift+Insert: the keys a terminal pastes on. This also has to catch the Ctrl+V
 * that Windows clipboard history (Win+V) sends when you pick an item, which comes with no scan
 * code. Missing it meant xterm typed a raw ^V into the shell instead, and an agent CLI read that
 * as "paste an image" and found none.
 */
export function isTerminalPasteKey(event: KeyEventLike): boolean {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && isShortcutLetter(event, 'v')) {
    return true;
  }
  return event.shiftKey && !event.ctrlKey && !event.altKey && event.key === 'Insert';
}

/** Ctrl/Cmd+C without Shift or Alt, which copies when the terminal has a selection. */
export function isTerminalCopyKey(event: KeyEventLike): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey &&
    isShortcutLetter(event, 'c')
  );
}
