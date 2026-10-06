import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from './fusion';

describe('reciprocalRankFusion', () => {
  it('ranks items found by both lists above items found by one', () => {
    expect(
      reciprocalRankFusion([
        ['a', 'b', 'c'],
        ['c', 'd', 'a'],
      ]),
    ).toEqual(['a', 'c', 'b', 'd']);
  });

  it('keeps a single list in its own order', () => {
    expect(reciprocalRankFusion([['x', 'y', 'z']])).toEqual(['x', 'y', 'z']);
  });

  it('handles empty input', () => {
    expect(reciprocalRankFusion([])).toEqual([]);
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });

  it('breaks ties by first appearance', () => {
    expect(
      reciprocalRankFusion([
        ['a', 'b'],
        ['b', 'a'],
      ]),
    ).toEqual(['a', 'b']);
  });
});
