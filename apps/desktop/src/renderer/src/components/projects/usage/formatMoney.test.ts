import { describe, expect, it } from 'vitest';
import { formatMoney } from './formatMoney';

/**
 * Dollar amounts on the Usage tab. A busy project runs into the thousands, so they are grouped
 * ($3,336.03) where the shared formatCost prints $3336.03.
 */

describe('formatMoney', () => {
  it('shows dollars and cents', () => {
    expect(formatMoney(128.4)).toBe('$128.40');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(0.01)).toBe('$0.01');
  });

  it('groups the thousands', () => {
    expect(formatMoney(3336.031)).toBe('$3,336.03');
    expect(formatMoney(1_234_567.891)).toBe('$1,234,567.89');
  });

  it('rounds to the cent', () => {
    expect(formatMoney(0.996)).toBe('$1.00');
    expect(formatMoney(2.004)).toBe('$2.00');
  });

  it('keeps a spend under a cent visible instead of rounding it to nothing', () => {
    expect(formatMoney(0.004)).toBe('<$0.01');
  });

  it('has no amount for an unknown cost', () => {
    expect(formatMoney(null)).toBeNull();
  });
});
