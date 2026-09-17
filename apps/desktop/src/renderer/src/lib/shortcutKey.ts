/**
 * True when the event is the given letter shortcut, regardless of keyboard
 * language. `event.code` is the physical key (KeyT stays KeyT on a Farsi
 * layout, even though `event.key` is ف). `event.key` is also accepted so
 * non-QWERTY layouts like Dvorak still match the letter the user typed.
 *
 * Keys sent by software rather than a keyboard can carry no scan code, and then
 * `event.code` is empty. Windows clipboard history (Win+V) pastes exactly that
 * way, with a synthesized Ctrl+V, so on a Farsi layout it arrives as key "ر"
 * with no code at all. `keyCode` is the Windows virtual key, which is still the
 * Latin letter, so it decides in that case.
 */
export function isShortcutLetter(
  event: Pick<KeyboardEvent, 'code' | 'key' | 'keyCode'>,
  letter: string,
): boolean {
  const lower = letter.toLowerCase();
  const upper = lower.toUpperCase();
  if (event.code === `Key${upper}` || event.key.toLowerCase() === lower) return true;
  return event.code === '' && event.keyCode === upper.charCodeAt(0);
}
