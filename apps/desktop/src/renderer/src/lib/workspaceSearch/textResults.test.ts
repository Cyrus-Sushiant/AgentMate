import { describe, expect, it } from 'vitest';
import { emptyTextResults, mergeBatch } from './textResults';

function line(n: number) {
  return { line: n, column: 1, text: 'x', textOffset: 0, ranges: [] as [number, number][] };
}

describe('mergeBatch', () => {
  it('adds matches in the order they arrive, keeping a file together', () => {
    let state = emptyTextResults('r1');
    state = mergeBatch(state, { requestId: 'r1', files: [{ path: 'a.ts', matches: [line(1)] }] });
    state = mergeBatch(state, {
      requestId: 'r1',
      files: [
        { path: 'b.ts', matches: [line(3)] },
        { path: 'a.ts', matches: [line(9)] },
      ],
    });
    expect(state.files.map((file) => [file.path, file.matches.map((m) => m.line)])).toEqual([
      ['a.ts', [1, 9]],
      ['b.ts', [3]],
    ]);
    expect(state.matches).toBe(3);
  });

  it('ignores results from a search that was replaced', () => {
    const state = emptyTextResults('new');
    expect(
      mergeBatch(state, { requestId: 'old', files: [{ path: 'a.ts', matches: [line(1)] }] }),
    ).toBe(state);
  });
});
