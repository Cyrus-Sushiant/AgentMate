/** Fills the array with random 32-bit values. `crypto.getRandomValues` fits this shape. */
export type RandomFill = (array: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  /** Leaves out characters that are easy to misread, like l, 1, I, O and 0. */
  avoidAmbiguous: boolean;
}

export const PASSWORD_LENGTH_MIN = 8;
export const PASSWORD_LENGTH_MAX = 128;

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: false,
};

// Quotes, backslash and backtick are left out on purpose: they break shells, CSV and .env files.
export const CHARACTER_SETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!#$%&*+-./:;<=>?@^_~()[]{},|',
} as const;

export const AMBIGUOUS_CHARACTERS = 'Il1O0o|';

type SetName = keyof typeof CHARACTER_SETS;
const SET_NAMES: SetName[] = ['lowercase', 'uppercase', 'digits', 'symbols'];

const platformRandom: RandomFill = (array) => globalThis.crypto.getRandomValues(array);

const TWO_POW_32 = 2 ** 32;

/**
 * A uniform integer in [0, max). Draws that land in the uneven tail above the largest multiple
 * of `max` are thrown away, because `x % max` on them would favor the small numbers.
 */
export function randomInt(max: number, rng: RandomFill = platformRandom): number {
  if (!Number.isInteger(max) || max < 1 || max > TWO_POW_32) {
    throw new RangeError(`randomInt needs an integer max between 1 and 2^32, got ${max}`);
  }
  const limit = TWO_POW_32 - (TWO_POW_32 % max);
  const draw = new Uint32Array(1);
  for (;;) {
    rng(draw);
    if (draw[0] < limit) return draw[0] % max;
  }
}

function selectedSets(options: PasswordOptions): string[] {
  return SET_NAMES.filter((name) => options[name]).map((name) =>
    options.avoidAmbiguous
      ? [...CHARACTER_SETS[name]].filter((c) => !AMBIGUOUS_CHARACTERS.includes(c)).join('')
      : CHARACTER_SETS[name],
  );
}

export function passwordOptionsError(options: PasswordOptions): string | null {
  if (
    !Number.isInteger(options.length) ||
    options.length < PASSWORD_LENGTH_MIN ||
    options.length > PASSWORD_LENGTH_MAX
  ) {
    return `Length must be a whole number from ${PASSWORD_LENGTH_MIN} to ${PASSWORD_LENGTH_MAX}.`;
  }
  const sets = selectedSets(options);
  if (sets.length === 0) return 'Pick at least one character set.';
  if (options.length < sets.length) return 'Length is shorter than the number of character sets.';
  return null;
}

/**
 * One character from every selected set so each shows up, the rest from the combined pool,
 * then a Fisher-Yates shuffle so those guaranteed characters don't always sit up front.
 */
export function generatePassword(
  options: PasswordOptions,
  rng: RandomFill = platformRandom,
): string {
  const error = passwordOptionsError(options);
  if (error) throw new RangeError(error);

  const sets = selectedSets(options);
  const pool = sets.join('');
  const chars = sets.map((set) => set[randomInt(set.length, rng)]);
  while (chars.length < options.length) chars.push(pool[randomInt(pool.length, rng)]);

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Bits of entropy for a password made with these options, or 0 when they are invalid. */
export function generatedEntropy(options: PasswordOptions): number {
  if (passwordOptionsError(options)) return 0;
  const poolSize = selectedSets(options).reduce((sum, set) => sum + set.length, 0);
  return options.length * Math.log2(poolSize);
}
