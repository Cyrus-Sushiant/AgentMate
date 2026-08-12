/**
 * True when the event is the given letter shortcut, regardless of keyboard
 * language. `event.code` is the physical key (KeyT stays KeyT on a Farsi
 * layout, even though `event.key` is ف). `event.key` is also accepted so
 * non-QWERTY layouts like Dvorak still match the letter the user typed.
 */
export function isShortcutLetter(
  event: Pick<KeyboardEvent, 'code' | 'key'>,
  letter: string,
): boolean {
  const lower = letter.toLowerCase();
  return event.code === `Key${lower.toUpperCase()}` || event.key.toLowerCase() === lower;
}
