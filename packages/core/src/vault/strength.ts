import { COMMON_PASSWORDS } from './commonPasswords.js';

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const;

export type StrengthLabel = (typeof STRENGTH_LABELS)[number];

export interface StrengthResult {
  /** Estimated entropy after penalties. Only a guide: it can't know what an attacker knows. */
  bits: number;
  score: StrengthScore;
  label: StrengthLabel;
  warnings: string[];
}

export function scoreForBits(bits: number): StrengthScore {
  if (bits < 28) return 0;
  if (bits < 36) return 1;
  if (bits < 60) return 2;
  if (bits < 80) return 3;
  return 4;
}

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./', '1234567890'];

const COMMON_WARNING = 'This is one of the most common passwords.';

/** How much a character that follows a repeat, sequence or pattern still counts. */
const PATTERN_WEIGHT = 0.2;

function poolSize(chars: string[]): number {
  let size = 0;
  if (chars.some((c) => /[a-z]/.test(c))) size += 26;
  if (chars.some((c) => /[A-Z]/.test(c))) size += 26;
  if (chars.some((c) => /[0-9]/.test(c))) size += 10;
  if (chars.some((c) => /[\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(c))) size += 33;
  if (chars.some((c) => (c.codePointAt(0) ?? 0) > 0x7e)) size += 100;
  return size;
}

/** Lowers every weight in [start, end) except the first to `weight`. */
function discount(weights: number[], start: number, end: number, weight: number): void {
  for (let i = start + 1; i < end; i++) weights[i] = Math.min(weights[i], weight);
}

function stripDecorations(value: string): string {
  return value.replace(/^[\d\W_]+/, '').replace(/[\d\W_]+$/, '');
}

function normalizedContext(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * A small, dependency-free estimate: character pool entropy, with characters that are part of
 * a repeat, a run like "abcd" or "4321", a keyboard row, a year, a common password or the entry's
 * own title or username counting for much less.
 */
export function estimateStrength(password: string, context: string[] = []): StrengthResult {
  const chars = [...password];
  if (chars.length === 0) return { bits: 0, score: 0, label: STRENGTH_LABELS[0], warnings: [] };

  let warnings = new Set<string>();
  const weights = chars.map(() => 1);
  const lower = password.toLowerCase();
  // Code-unit offsets from the regex and string searches below map to code point indexes here.
  const indexOfUnit = (unit: number) => [...password.slice(0, unit)].length;

  // Every repeat or step counts for less, but only a run of three or more earns a warning: any
  // random password has the odd "ab" or "zz" in it.
  let repeatRun = 1;
  let stepRun = 1;
  for (let i = 1; i < chars.length; i++) {
    const prev = chars[i - 1].codePointAt(0) ?? 0;
    const current = chars[i].codePointAt(0) ?? 0;
    const repeat = current === prev;
    const step = !repeat && Math.abs(current - prev) === 1 && /[\p{L}\p{N}]/u.test(chars[i]);
    repeatRun = repeat ? repeatRun + 1 : 1;
    stepRun = step ? stepRun + 1 : 1;
    if (repeat || step) weights[i] = PATTERN_WEIGHT;
    if (repeatRun >= 3) warnings.add('Repeated characters are easy to guess.');
    if (stepRun >= 3) warnings.add('Runs like "abcd" or "1234" are easy to guess.');
  }

  for (const row of KEYBOARD_ROWS) {
    for (const line of [row, [...row].reverse().join('')]) {
      for (let len = line.length; len >= 4; len--) {
        for (let start = 0; start + len <= line.length; start++) {
          let at = lower.indexOf(line.slice(start, start + len));
          while (at !== -1) {
            discount(weights, indexOfUnit(at), indexOfUnit(at + len), PATTERN_WEIGHT);
            warnings.add('Keyboard patterns like "qwerty" are easy to guess.');
            at = lower.indexOf(line.slice(start, start + len), at + 1);
          }
        }
      }
    }
  }

  for (const match of password.matchAll(/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?:19|20)\d{2}/g)) {
    const start = indexOfUnit(match.index ?? 0);
    discount(weights, start, start + match[0].length, 0);
    warnings.add('Years and dates are easy to guess.');
  }

  const contextWords = new Set<string>();
  for (const value of context) {
    const whole = normalizedContext(value);
    if (whole.length >= 3) contextWords.add(whole);
    for (const word of value.split(/[^\p{L}\p{N}]+/u)) {
      if (word.length >= 3) contextWords.add(word.toLowerCase());
    }
  }
  for (const word of contextWords) {
    let at = lower.indexOf(word);
    while (at !== -1) {
      discount(weights, indexOfUnit(at), indexOfUnit(at + word.length), 0);
      warnings.add('Avoid putting the title, username or site name in the password.');
      at = lower.indexOf(word, at + 1);
    }
  }

  let bits = weights.reduce((sum, w) => sum + w, 0) * Math.log2(poolSize(chars));

  if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(stripDecorations(lower))) {
    bits = Math.min(bits, 10);
    // Listed first: it matters more than any pattern found inside it.
    warnings = new Set([COMMON_WARNING, ...warnings]);
  }

  const score = scoreForBits(bits);
  return {
    bits: Math.round(bits * 10) / 10,
    score,
    label: STRENGTH_LABELS[score],
    warnings: [...warnings],
  };
}
