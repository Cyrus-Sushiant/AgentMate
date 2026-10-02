import type { RdpInputOp } from '../../shared/apiTypes';

/**
 * Key names the AI may use in a `KEY` action, mapped to PS/2 set 1 scancodes, which is what RDP
 * sends for a key press. Extended keys are one number with 0xE0 in the high byte, the form the
 * Remote Desktop window passes on as is.
 */
const SCANCODES: Record<string, number> = {
  esc: 0x01,
  '1': 0x02,
  '2': 0x03,
  '3': 0x04,
  '4': 0x05,
  '5': 0x06,
  '6': 0x07,
  '7': 0x08,
  '8': 0x09,
  '9': 0x0a,
  '0': 0x0b,
  minus: 0x0c,
  equals: 0x0d,
  backspace: 0x0e,
  tab: 0x0f,
  q: 0x10,
  w: 0x11,
  e: 0x12,
  r: 0x13,
  t: 0x14,
  y: 0x15,
  u: 0x16,
  i: 0x17,
  o: 0x18,
  p: 0x19,
  leftbracket: 0x1a,
  rightbracket: 0x1b,
  enter: 0x1c,
  ctrl: 0x1d,
  a: 0x1e,
  s: 0x1f,
  d: 0x20,
  f: 0x21,
  g: 0x22,
  h: 0x23,
  j: 0x24,
  k: 0x25,
  l: 0x26,
  semicolon: 0x27,
  quote: 0x28,
  backquote: 0x29,
  shift: 0x2a,
  backslash: 0x2b,
  z: 0x2c,
  x: 0x2d,
  c: 0x2e,
  v: 0x2f,
  b: 0x30,
  n: 0x31,
  m: 0x32,
  comma: 0x33,
  period: 0x34,
  slash: 0x35,
  rshift: 0x36,
  alt: 0x38,
  space: 0x39,
  capslock: 0x3a,
  f1: 0x3b,
  f2: 0x3c,
  f3: 0x3d,
  f4: 0x3e,
  f5: 0x3f,
  f6: 0x40,
  f7: 0x41,
  f8: 0x42,
  f9: 0x43,
  f10: 0x44,
  f11: 0x57,
  f12: 0x58,
  rctrl: 0xe01d,
  ralt: 0xe038,
  home: 0xe047,
  up: 0xe048,
  pageup: 0xe049,
  left: 0xe04b,
  right: 0xe04d,
  end: 0xe04f,
  down: 0xe050,
  pagedown: 0xe051,
  insert: 0xe052,
  delete: 0xe053,
  win: 0xe05b,
  menu: 0xe05d,
};

/** Other names models use for the same keys, including the punctuation characters themselves. */
const ALIASES: Record<string, string> = {
  cmd: 'win',
  command: 'win',
  meta: 'win',
  super: 'win',
  windows: 'win',
  lwin: 'win',
  control: 'ctrl',
  lctrl: 'ctrl',
  lshift: 'shift',
  lalt: 'alt',
  option: 'alt',
  del: 'delete',
  ins: 'insert',
  return: 'enter',
  escape: 'esc',
  pgup: 'pageup',
  pgdn: 'pagedown',
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  caps: 'capslock',
  apps: 'menu',
  contextmenu: 'menu',
  spacebar: 'space',
  '-': 'minus',
  '=': 'equals',
  '[': 'leftbracket',
  ']': 'rightbracket',
  ';': 'semicolon',
  "'": 'quote',
  '`': 'backquote',
  '\\': 'backslash',
  ',': 'comma',
  '.': 'period',
  '/': 'slash',
};

/** The one name a key goes by here, so `Windows+R` and `win+r` compare equal. */
export function normalizeKeyName(name: string): string {
  const lower = name.trim().toLowerCase();
  return ALIASES[lower] ?? lower;
}

export function scancodeFor(name: string): number | null {
  return SCANCODES[normalizeKeyName(name)] ?? null;
}

/** The keys of a combo like `ctrl+shift+esc`, normalized, or null when one is empty. */
export function comboKeys(combo: string): string[] | null {
  const keys = combo.split('+').map(normalizeKeyName);
  return keys.some((key) => key === '') ? null : keys;
}

/**
 * Presses the keys of a combo in order and lets them go in reverse, the way a person holds
 * modifiers. Null when any key is unknown, so nothing half-pressed is ever sent.
 */
export function comboToOps(combo: string): RdpInputOp[] | null {
  const keys = comboKeys(combo);
  if (!keys) return null;
  const codes: number[] = [];
  for (const key of keys) {
    const code = SCANCODES[key];
    if (code === undefined) return null;
    codes.push(code);
  }
  return [
    ...codes.map((scancode): RdpInputOp => ({ kind: 'key', scancode, down: true })),
    ...codes.reverse().map((scancode): RdpInputOp => ({ kind: 'key', scancode, down: false })),
  ];
}
