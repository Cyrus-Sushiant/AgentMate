import { describe, expect, it } from 'vitest';
import { estimateStrength, STRENGTH_LABELS, scoreForBits } from './strength.js';

describe('scoreForBits', () => {
  it('maps entropy bands to scores', () => {
    expect(scoreForBits(0)).toBe(0);
    expect(scoreForBits(27.9)).toBe(0);
    expect(scoreForBits(28)).toBe(1);
    expect(scoreForBits(36)).toBe(2);
    expect(scoreForBits(60)).toBe(3);
    expect(scoreForBits(80)).toBe(4);
    expect(scoreForBits(500)).toBe(4);
  });
});

describe('estimateStrength', () => {
  it('scores an empty password as 0 with no bits', () => {
    const result = estimateStrength('');
    expect(result.bits).toBe(0);
    expect(result.score).toBe(0);
    expect(result.label).toBe(STRENGTH_LABELS[0]);
  });

  it('grows with length for random-looking passwords', () => {
    const short = estimateStrength('kX9#mP2$');
    const medium = estimateStrength('kX9#mP2$qL7!');
    const long = estimateStrength('kX9#mP2$qL7!vB4&zT8*');
    expect(medium.bits).toBeGreaterThan(short.bits);
    expect(long.bits).toBeGreaterThan(medium.bits);
    expect(long.score).toBe(4);
  });

  it.each(['password', 'Password1', '123456', 'qwerty123', 'letmein!', 'iloveyou'])(
    'treats the common password %s as very weak',
    (password) => {
      const result = estimateStrength(password);
      expect(result.score).toBe(0);
      expect(result.warnings[0]).toMatch(/common/i);
    },
  );

  it('penalizes repeats and sequences', () => {
    expect(estimateStrength('aaaaaaaaaaaa').score).toBeLessThanOrEqual(1);
    expect(estimateStrength('abcdefghijkl').score).toBeLessThanOrEqual(1);
    expect(estimateStrength('987654321098').score).toBeLessThanOrEqual(1);
    expect(estimateStrength('asdfghjkl;').score).toBeLessThanOrEqual(1);
    expect(estimateStrength('aaaaaaaaaaaa').warnings.length).toBeGreaterThan(0);
  });

  it('does not warn about a lone pair of neighbouring or repeated characters', () => {
    const result = estimateStrength('gxI8];1F{F_TInXm.si^ab');
    expect(result.warnings).toEqual([]);
    expect(estimateStrength('Qp7!zz#Lm2$w').warnings).toEqual([]);
    expect(estimateStrength('Qp7!zzz#Lm2$w').warnings.join(' ')).toMatch(/Repeated/);
    expect(estimateStrength('Qp7!xyz#Lm2$w').warnings.join(' ')).toMatch(/Runs like/);
  });

  it('warns about years and dates', () => {
    const plain = estimateStrength('tiger-lamp-K');
    const withYear = estimateStrength('tiger-lamp-K1987');
    expect(withYear.warnings.join(' ')).toMatch(/year|date/i);
    expect(withYear.bits - plain.bits).toBeLessThan(4 * Math.log2(10));
  });

  it('penalizes names from the context such as the title or username', () => {
    const without = estimateStrength('johnsmith#Q8');
    const withContext = estimateStrength('johnsmith#Q8', ['John Smith', 'johnsmith']);
    expect(withContext.bits).toBeLessThan(without.bits);
    expect(withContext.warnings.join(' ')).toMatch(/username|title|name/i);
  });

  it('gives a strong generated-looking password the top score', () => {
    expect(estimateStrength('G7$wq!Lz2#Pm9@Xc4%Rt').score).toBe(4);
  });

  it('counts non-Latin characters instead of ignoring them', () => {
    expect(estimateStrength('رمز-عبور-بسیار-طولانی').bits).toBeGreaterThan(60);
  });
});
