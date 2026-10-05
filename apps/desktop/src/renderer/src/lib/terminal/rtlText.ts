/**
 * A terminal stores text in the order it was typed and draws one character per cell, left to
 * right. That is wrong for Persian, Arabic and Hebrew: the words read backwards and the letters
 * never join. The fix (see terminalRtl.ts) hands each stretch of right-to-left text to the
 * browser as one piece, which shapes it and lays it out right to left inside the same cells.
 * This file decides where those stretches are and how many cells they cover.
 */

// Hebrew, Arabic, Syriac, Thaana, NKo and the Arabic extensions, plus their presentation forms
// and the right-to-left scripts outside the Basic Multilingual Plane.
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-ﻼ\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]/u;

// A letter or digit in any script. Punctuation in front of the text (a shell prompt, a list
// bullet) stays outside the run so it keeps its place on the left.
const WORD_START = /[\p{L}\p{N}]/u;

// Box drawing and block elements: the borders TUIs draw around text.
const BORDER_CHAR = /[─-▟]/;

// Opening quotes and brackets, keyed by the character that closes each.
const OPENER_FOR: Record<string, string> = {
  '"': '"',
  "'": "'",
  ')': '(',
  ']': '[',
  '»': '«',
  '”': '“',
};

/** True where the text breaks into separate columns: a border, a tab, or two spaces. */
function breaksAt(text: string, index: number): boolean {
  const ch = text[index];
  if (ch === '\t' || BORDER_CHAR.test(ch)) return true;
  return ch === ' ' && text[index + 1] === ' ';
}

/**
 * The [start, end) ranges of `text` to draw as right-to-left runs. A run is one column of text
 * (TUIs separate columns with borders or wide gaps) that holds a right-to-left letter, from its
 * first word to its last visible character. English words inside a Persian sentence stay in
 * the run so they land in the right place, and a run that starts with an English word keeps
 * English direction (see startsRightToLeft).
 *
 * This is the handler for xterm's `registerCharacterJoiner`.
 */
export function rtlRuns(text: string): [number, number][] {
  const runs: [number, number][] = [];
  let index = 0;
  while (index < text.length) {
    let chunkEnd = index;
    while (chunkEnd < text.length && !breaksAt(text, chunkEnd)) chunkEnd++;
    const chunk = text.slice(index, chunkEnd);
    if (RTL_CHAR.test(chunk)) {
      let start = index;
      while (start < chunkEnd && !WORD_START.test(text[start])) start++;
      let end = chunkEnd;
      while (end > start && text[end - 1] === ' ') end--;
      // A quote or bracket the run closes belongs to it, or both marks would end up on one side.
      const opener = OPENER_FOR[text[end - 1]];
      if (start > index && opener !== undefined && text[start - 1] === opener) start--;
      // A single letter has nothing to join with and already sits in the right cell.
      if (end - start > 1) runs.push([start, end]);
    }
    index = chunkEnd;
    while (index < text.length && (text[index] === ' ' || breaksAt(text, index))) index++;
  }
  return runs;
}

/**
 * True when the first letter of `text` is right to left. Numbers and punctuation do not decide
 * it, the same rule a browser uses to pick a paragraph's direction.
 */
export function startsRightToLeft(text: string): boolean {
  const firstLetter = /\p{L}/u.exec(text);
  return firstLetter !== null && RTL_CHAR.test(firstLetter[0]);
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

type GraphemeKind = 'rtl' | 'ltr' | 'digit' | 'other';

function graphemeKind(grapheme: string): GraphemeKind {
  if (/^\p{N}/u.test(grapheme)) return 'digit';
  if (RTL_CHAR.test(grapheme[0])) return 'rtl';
  if (/^\p{L}/u.test(grapheme)) return 'ltr';
  return 'other';
}

const RIGHT_TO_LEFT_ISOLATE = String.fromCodePoint(0x2067);
const POP_DIRECTIONAL_ISOLATE = String.fromCodePoint(0x2069);

/**
 * For text a program already put in display order (Claude Code reorders right-to-left text
 * itself before writing it, for terminals without bidi support), each right-to-left stretch is
 * turned back into reading order and wrapped in an isolate. Laid out left to right, every
 * stretch then lands exactly where the program drew it, but the browser can join its letters.
 * Numbers and English words between the stretches are already in reading order and stay put.
 * Stretches are reversed by grapheme, so vowel marks and the zero-width non-joiner stay on
 * their letter, the same way the program reversed them.
 */
export function shapeVisualRuns(text: string): string {
  const parts = Array.from(graphemes.segment(text), (part) => part.segment);
  let out = '';
  let index = 0;
  while (index < parts.length) {
    if (graphemeKind(parts[index]) !== 'rtl') {
      out += parts[index++];
      continue;
    }
    // A stretch runs from one right-to-left letter to the last one reachable through spaces and
    // punctuation, so the punctuation between words travels with them.
    let end = index + 1;
    for (let next = end; next < parts.length; next++) {
      const kind = graphemeKind(parts[next]);
      if (kind === 'rtl') end = next + 1;
      else if (kind !== 'other') break;
    }
    const stretch = parts.slice(index, end).reverse().join('');
    out += `${RIGHT_TO_LEFT_ISOLATE}${stretch}${POP_DIRECTIONAL_ISOLATE}`;
    index = end;
  }
  return out;
}

// Marks and format characters (the zero-width non-joiner, vowel marks, joiners) take no cell of
// their own in xterm, and neither do the Hangul vowel and final jamo that follow a leading one.
const ZERO_WIDTH = /[\p{Mn}\p{Me}\p{Cf}]/u;
const HANGUL_JAMO_TAIL: [number, number] = [0x1160, 0x11ff];
// The one format character xterm still draws in a cell of its own.
const SOFT_HYPHEN = 0xad;

function isZeroWidth(ch: string, codePoint: number): boolean {
  if (codePoint === SOFT_HYPHEN) return false;
  if (codePoint >= HANGUL_JAMO_TAIL[0] && codePoint <= HANGUL_JAMO_TAIL[1]) return true;
  return ZERO_WIDTH.test(ch);
}

// The East Asian wide ranges from xterm's default Unicode 6 tables. Emoji are not among them:
// those tables draw an emoji in a single cell.
const WIDE_RANGES: [number, number][] = [
  [0x1100, 0x115f],
  [0x2329, 0x232a],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
];

function isWide(codePoint: number): boolean {
  return WIDE_RANGES.some(([low, high]) => codePoint >= low && codePoint <= high);
}

/** How many terminal cells `text` covers, counted the way xterm counts them. */
export function cellWidth(text: string): number {
  let cells = 0;
  for (const ch of text) {
    const codePoint = ch.codePointAt(0) ?? 0;
    if (isZeroWidth(ch, codePoint)) continue;
    cells += isWide(codePoint) ? 2 : 1;
  }
  return cells;
}
