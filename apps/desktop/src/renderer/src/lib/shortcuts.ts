/**
 * App-wide keyboard shortcuts.
 *
 * A binding is stored as the physical key (`KeyboardEvent.code`), never as the
 * character it produces. That is what keeps Ctrl+T working after the user
 * switches to a Farsi, Russian or Greek layout, where the same key reports
 * `event.key === 'ف'`. `event.key` is still accepted as a fallback for letters
 * so remapped layouts like Dvorak match the letter the user actually typed.
 */

export interface Shortcut {
  /** `KeyboardEvent.code`, e.g. `KeyT`, `Backquote`, `Comma`. */
  code: string;
  /** Ctrl on Windows/Linux, Command on macOS. The app treats the two as one key. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export type ShortcutCommandId =
  | 'terminal.toggle'
  | 'terminal.new'
  | 'nav.projects'
  | 'search.toggle'
  | 'prompt.generate'
  | 'prompt.translate'
  | 'prompt.copy';

/**
 * Where a shortcut is listened for. `global` runs anywhere in the shell;
 * `prompt` only runs while the prompt builder is on screen, and takes
 * precedence there. Two scopes may share a combination, which is how the
 * prompt builder keeps Ctrl+T for translating while the rest of the app uses
 * it for the terminal.
 */
export type ShortcutScope = 'global' | 'prompt';

export type GlobalShortcutCommandId = Exclude<ShortcutCommandId, `prompt.${string}`>;
export type PromptShortcutCommandId = Extract<ShortcutCommandId, `prompt.${string}`>;

/** The ids a given scope can produce, so callers get an exhaustive union. */
export type ShortcutCommandIdOf<S extends ShortcutScope> = S extends 'prompt'
  ? PromptShortcutCommandId
  : GlobalShortcutCommandId;

export interface ShortcutCommand {
  id: ShortcutCommandId;
  label: string;
  description: string;
  group: string;
  scope: ShortcutScope;
  defaults: Shortcut[];
}

export const SHORTCUT_COMMANDS: ShortcutCommand[] = [
  {
    id: 'terminal.toggle',
    label: 'Toggle terminal',
    description: 'Opens the terminal drawer, or closes it when it is already open.',
    group: 'Terminal',
    scope: 'global',
    defaults: [
      { code: 'KeyT', mod: true },
      { code: 'Backquote', mod: true },
    ],
  },
  {
    id: 'terminal.new',
    label: 'New terminal tab',
    description: 'Starts another shell in the drawer.',
    group: 'Terminal',
    scope: 'global',
    defaults: [{ code: 'Backquote', mod: true, shift: true }],
  },
  {
    id: 'nav.projects',
    label: 'Go to Projects',
    description: 'Opens the projects page.',
    group: 'Navigation',
    scope: 'global',
    defaults: [{ code: 'KeyP', mod: true }],
  },
  {
    id: 'search.toggle',
    label: 'Command palette',
    description: 'Opens search across projects, pages and commands.',
    group: 'Navigation',
    scope: 'global',
    defaults: [{ code: 'KeyK', mod: true }],
  },
  {
    id: 'prompt.generate',
    label: 'Generate prompt',
    description: 'Builds the prompt from your request.',
    group: 'Prompt builder',
    scope: 'prompt',
    defaults: [
      { code: 'KeyG', mod: true },
      { code: 'Enter', mod: true },
    ],
  },
  {
    id: 'prompt.translate',
    label: 'Translate request',
    description: 'Rewrites your request in English without generating.',
    group: 'Prompt builder',
    scope: 'prompt',
    defaults: [{ code: 'KeyT', mod: true }],
  },
  {
    id: 'prompt.copy',
    label: 'Copy generated prompt',
    description: 'Copies the result. Ignored while text is selected, so normal copy still works.',
    group: 'Prompt builder',
    scope: 'prompt',
    defaults: [{ code: 'KeyC', mod: true }],
  },
];

export const SHORTCUT_GROUPS: { name: string; scope: ShortcutScope; hint?: string }[] = [
  { name: 'Terminal', scope: 'global' },
  { name: 'Navigation', scope: 'global' },
  {
    name: 'Prompt builder',
    scope: 'prompt',
    hint: 'Only while the prompt builder is open, where they beat the app-wide shortcuts.',
  },
];

const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'CapsLock',
]);

type KeyEventLike = Pick<
  KeyboardEvent,
  'code' | 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
>;

function letterOf(code: string): string | null {
  return /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : null;
}

/** Reads a binding off a keypress. Null while only modifiers are held down. */
export function shortcutFromEvent(event: KeyEventLike): Shortcut | null {
  if (!event.code || MODIFIER_CODES.has(event.code)) return null;
  const shortcut: Shortcut = { code: event.code };
  if (event.ctrlKey || event.metaKey) shortcut.mod = true;
  if (event.shiftKey) shortcut.shift = true;
  if (event.altKey) shortcut.alt = true;
  return shortcut;
}

export function matchesShortcut(event: KeyEventLike, shortcut: Shortcut): boolean {
  if ((event.ctrlKey || event.metaKey) !== Boolean(shortcut.mod)) return false;
  if (event.shiftKey !== Boolean(shortcut.shift)) return false;
  if (event.altKey !== Boolean(shortcut.alt)) return false;
  if (event.code === shortcut.code) return true;
  const letter = letterOf(shortcut.code);
  return letter !== null && event.key.toLowerCase() === letter;
}

/** Stable string form, used for comparing and for React keys. */
export function shortcutId(shortcut: Shortcut): string {
  return [
    shortcut.mod ? 'mod' : '',
    shortcut.alt ? 'alt' : '',
    shortcut.shift ? 'shift' : '',
    shortcut.code,
  ]
    .filter(Boolean)
    .join('+');
}

export function sameShortcut(a: Shortcut, b: Shortcut): boolean {
  return shortcutId(a) === shortcutId(b);
}

export function hasModifier(shortcut: Shortcut): boolean {
  return Boolean(shortcut.mod || shortcut.alt);
}

/** True when the binding cannot be mistaken for the user typing into a field. */
export function isSafeWhileTyping(shortcut: Shortcut): boolean {
  return hasModifier(shortcut) || /^F\d{1,2}$/.test(shortcut.code);
}

/**
 * Why a binding cannot be accepted, or null when it is fine. Anything without
 * Ctrl/Cmd/Alt would swallow ordinary typing, so only the function keys are
 * allowed to stand on their own.
 */
export function bindingProblem(shortcut: Shortcut): string | null {
  return isSafeWhileTyping(shortcut) ? null : 'Hold Ctrl, Cmd, or Alt, or use a function key.';
}

const KEY_LABELS: Record<string, string> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '\\',
  Space: 'Space',
  Enter: 'Enter',
  NumpadEnter: 'Num Enter',
  Escape: 'Esc',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Del',
  Insert: 'Ins',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .',
};

/** Human name for a physical key, independent of the active keyboard layout. */
export function keyLabel(code: string): string {
  const letter = letterOf(code);
  if (letter) return letter.toUpperCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
  if (/^F\d{1,2}$/.test(code)) return code;
  return KEY_LABELS[code] ?? code;
}

export function isMacPlatform(): boolean {
  return typeof window !== 'undefined' && window.agentmat?.platform === 'darwin';
}

export function formatShortcut(shortcut: Shortcut): string {
  const mac = isMacPlatform();
  const parts: string[] = [];
  if (shortcut.mod) parts.push(mac ? '⌘' : 'Ctrl');
  if (shortcut.alt) parts.push(mac ? '⌥' : 'Alt');
  if (shortcut.shift) parts.push(mac ? '⇧' : 'Shift');
  parts.push(keyLabel(shortcut.code));
  return parts.join(mac ? '' : '+');
}
