import { describe, expect, it } from 'vitest';
import {
  AMBIGUOUS_CHARACTERS,
  CHARACTER_SETS,
  DEFAULT_PASSWORD_OPTIONS,
  generatedEntropy,
  generatePassword,
  type PasswordOptions,
  passwordOptionsError,
  type RandomFill,
  randomInt,
} from './generator.js';

/** xorshift32: deterministic, so a failure here always reproduces. */
function seeded(seed: number): RandomFill {
  let state = seed >>> 0 || 1;
  return (array) => {
    for (let i = 0; i < array.length; i++) {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      array[i] = state;
    }
    return array;
  };
}

function sequence(values: number[]): RandomFill {
  let index = 0;
  return (array) => {
    for (let i = 0; i < array.length; i++) array[i] = values[index++ % values.length];
    return array;
  };
}

const ALL: PasswordOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: false,
};

describe('randomInt', () => {
  it('discards draws from the biased tail instead of folding them in', () => {
    // 2^32 - 1 is above the largest multiple of 10 below 2^32, so it must be thrown away.
    expect(randomInt(10, sequence([0xffffffff, 7]))).toBe(7);
    expect(randomInt(10, sequence([0xfffffffa, 0xfffffff9]))).toBe(0xfffffff9 % 10);
  });

  it('never returns max or a negative number', () => {
    const rng = seeded(42);
    for (let i = 0; i < 5000; i++) {
      const value = randomInt(7, rng);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it('rejects a max outside 1..2^32', () => {
    expect(() => randomInt(0, seeded(1))).toThrow();
    expect(() => randomInt(1.5, seeded(1))).toThrow();
    expect(() => randomInt(2 ** 32 + 1, seeded(1))).toThrow();
  });

  it('is close to uniform', () => {
    const rng = seeded(1234);
    const buckets = new Array<number>(62).fill(0);
    const draws = 100_000;
    for (let i = 0; i < draws; i++) buckets[randomInt(62, rng)]++;
    const expected = draws / 62;
    const chiSquare = buckets.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
    // 61 degrees of freedom: the 99.9th percentile is about 100.
    expect(chiSquare).toBeLessThan(110);
  });
});

describe('passwordOptionsError', () => {
  it('accepts the defaults', () => {
    expect(passwordOptionsError(DEFAULT_PASSWORD_OPTIONS)).toBeNull();
  });

  it('needs at least one character set', () => {
    expect(
      passwordOptionsError({
        ...ALL,
        lowercase: false,
        uppercase: false,
        digits: false,
        symbols: false,
      }),
    ).toMatch(/character/i);
  });

  it('keeps the length within bounds', () => {
    expect(passwordOptionsError({ ...ALL, length: 7 })).toMatch(/length/i);
    expect(passwordOptionsError({ ...ALL, length: 129 })).toMatch(/length/i);
    expect(passwordOptionsError({ ...ALL, length: 12.5 })).toMatch(/length/i);
  });
});

describe('generatePassword', () => {
  it('returns exactly the requested length', () => {
    const rng = seeded(7);
    for (const length of [8, 16, 33, 128]) {
      expect(generatePassword({ ...ALL, length }, rng)).toHaveLength(length);
    }
  });

  it('includes every selected set in every password', () => {
    const rng = seeded(99);
    for (let i = 0; i < 10_000; i++) {
      const password = generatePassword({ ...ALL, length: 8 }, rng);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect([...password].some((c) => CHARACTER_SETS.symbols.includes(c))).toBe(true);
    }
  });

  it('only uses characters from the selected sets', () => {
    const rng = seeded(5);
    for (let i = 0; i < 500; i++) {
      const password = generatePassword(
        { ...ALL, uppercase: false, symbols: false, length: 24 },
        rng,
      );
      expect(password).toMatch(/^[a-z0-9]+$/);
    }
  });

  it('leaves out look-alike characters when asked', () => {
    const rng = seeded(11);
    for (let i = 0; i < 2000; i++) {
      const password = generatePassword({ ...ALL, avoidAmbiguous: true, length: 32 }, rng);
      for (const char of AMBIGUOUS_CHARACTERS) expect(password).not.toContain(char);
    }
  });

  it('shuffles, so the guaranteed characters are not always up front', () => {
    const rng = seeded(2024);
    let lowercaseFirst = 0;
    const runs = 2000;
    for (let i = 0; i < runs; i++) {
      if (/^[a-z]/.test(generatePassword({ ...ALL, length: 8 }, rng))) lowercaseFirst++;
    }
    expect(lowercaseFirst / runs).toBeLessThan(0.6);
  });

  it('throws for invalid options', () => {
    expect(() => generatePassword({ ...ALL, length: 3 }, seeded(1))).toThrow();
  });

  it('works with the platform random source by default', () => {
    expect(generatePassword(DEFAULT_PASSWORD_OPTIONS)).toHaveLength(
      DEFAULT_PASSWORD_OPTIONS.length,
    );
  });
});

describe('generatedEntropy', () => {
  it('is length times log2 of the pool size', () => {
    const pool =
      CHARACTER_SETS.lowercase.length +
      CHARACTER_SETS.uppercase.length +
      CHARACTER_SETS.digits.length +
      CHARACTER_SETS.symbols.length;
    expect(generatedEntropy(ALL)).toBeCloseTo(20 * Math.log2(pool), 6);
    expect(generatedEntropy({ ...ALL, uppercase: false, symbols: false, length: 10 })).toBeCloseTo(
      10 * Math.log2(36),
      6,
    );
  });

  it('shrinks when ambiguous characters are removed and is 0 for invalid options', () => {
    expect(generatedEntropy({ ...ALL, avoidAmbiguous: true })).toBeLessThan(generatedEntropy(ALL));
    expect(generatedEntropy({ ...ALL, length: 2 })).toBe(0);
  });
});
