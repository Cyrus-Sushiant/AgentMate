import { describe, expect, it } from 'vitest';
import { makeFinding, makeFindings } from './__fixtures__/findings.js';
import {
  countSecurityFindingsBySeverity,
  scoreSecurityFindings,
  sortSecurityFindings,
} from './score.js';

describe('countSecurityFindingsBySeverity', () => {
  it('always returns all five buckets, zeroed where nothing matched', () => {
    expect(countSecurityFindingsBySeverity([])).toEqual({
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    });
  });

  it('counts every finding, including the ones the score discounts', () => {
    const counts = countSecurityFindingsBySeverity([
      ...makeFindings(2, { severity: 'critical' }),
      ...makeFindings(3, { severity: 'critical', kind: 'hotspot' }),
      makeFinding({ severity: 'info' }),
    ]);
    // Hotspots are worth a quarter to the score, but they are still real rows in the report.
    expect(counts).toEqual({ critical: 5, high: 0, medium: 0, low: 0, info: 1 });
  });
});

describe('scoreSecurityFindings', () => {
  it('scores a clean scan 100 and calls it safe', () => {
    expect(scoreSecurityFindings([])).toEqual({
      score: 100,
      verdict: 'safe',
      counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    });
  });

  it('never lets info findings move the score', () => {
    const result = scoreSecurityFindings(makeFindings(50, { severity: 'info' }));
    expect(result.score).toBe(100);
    expect(result.verdict).toBe('safe');
    expect(result.counts.info).toBe(50);
  });

  it('curves logarithmically, so one noisy rule cannot zero the score', () => {
    const one = scoreSecurityFindings(makeFindings(1, { severity: 'low' })).score;
    const ten = scoreSecurityFindings(makeFindings(10, { severity: 'low' })).score;
    const fourHundred = scoreSecurityFindings(makeFindings(400, { severity: 'low' })).score;
    expect(one).toBe(98);
    expect(ten).toBe(93);
    // 40x the findings costs 5 more points than 10 did, which is the whole point of the curve.
    expect(fourHundred).toBe(83);
  });

  it('weighs a Sonar hotspot as a quarter of a confirmed finding', () => {
    // Four hotspot criticals weigh exactly one confirmed critical.
    const hotspots = scoreSecurityFindings(
      makeFindings(4, { severity: 'critical', kind: 'hotspot' }),
    );
    const confirmed = scoreSecurityFindings(makeFindings(1, { severity: 'critical' }));
    expect(hotspots.score).toBe(confirmed.score);
    // The discount reaches the verdict too: one weighted critical is 'risky', not 'dangerous'.
    expect(hotspots.verdict).toBe('risky');
    expect(scoreSecurityFindings(makeFindings(4, { severity: 'critical' })).verdict).toBe(
      'dangerous',
    );
  });

  it('holds the verdict bands at their exact edges', () => {
    // 31 lows weigh 2 * log2(32) = 10 exactly, so the score lands on the safe boundary.
    const onNinety = scoreSecurityFindings(makeFindings(31, { severity: 'low' }));
    expect(onNinety).toMatchObject({ score: 90, verdict: 'safe' });
    expect(scoreSecurityFindings(makeFindings(45, { severity: 'low' }))).toMatchObject({
      score: 89,
      verdict: 'caution',
    });

    // 15 mediums (7 * log2(16) = 28) plus one low (2) weigh 30 exactly.
    const onSeventy = [
      ...makeFindings(15, { severity: 'medium' }),
      makeFinding({ severity: 'low' }),
    ];
    expect(scoreSecurityFindings(onSeventy)).toMatchObject({ score: 70, verdict: 'caution' });
    expect(
      scoreSecurityFindings([
        ...makeFindings(15, { severity: 'medium' }),
        ...makeFindings(2, { severity: 'low' }),
      ]),
    ).toMatchObject({ score: 69, verdict: 'risky' });

    // 7 highs (18 * log2(8) = 54) plus 7 lows (6) weigh 60 exactly. Highs only ever pull a 'safe'
    // down to 'caution', so the band is what decides here.
    expect(
      scoreSecurityFindings([
        ...makeFindings(7, { severity: 'high' }),
        ...makeFindings(7, { severity: 'low' }),
      ]),
    ).toMatchObject({ score: 40, verdict: 'risky' });
    expect(
      scoreSecurityFindings([
        ...makeFindings(7, { severity: 'high' }),
        ...makeFindings(10, { severity: 'low' }),
      ]),
    ).toMatchObject({ score: 39, verdict: 'dangerous' });
  });

  it('refuses to call a report with a critical anything reassuring', () => {
    // 66 sits in the 'caution' band on its own, but a confirmed critical overrides the band.
    const one = scoreSecurityFindings(makeFindings(1, { severity: 'critical' }));
    expect(one).toMatchObject({ score: 66, verdict: 'risky' });
    // Two criticals is 'dangerous' however small the rest of the report is.
    expect(scoreSecurityFindings(makeFindings(2, { severity: 'critical' })).verdict).toBe(
      'dangerous',
    );
  });

  it('pulls a high-only report out of the safe band', () => {
    const result = scoreSecurityFindings(makeFindings(1, { severity: 'high' }));
    expect(result).toMatchObject({ score: 82, verdict: 'caution' });
  });

  it('floors the score at zero rather than going negative', () => {
    const result = scoreSecurityFindings(makeFindings(500, { severity: 'critical' }));
    expect(result.score).toBe(0);
    expect(result.verdict).toBe('dangerous');
  });
});

describe('sortSecurityFindings', () => {
  it('orders worst first, then by file, then by line', () => {
    const findings = [
      makeFinding({ id: 'a', severity: 'low', file: 'src/a.ts', line: 1 }),
      makeFinding({ id: 'b', severity: 'critical', file: 'src/z.ts', line: 9 }),
      makeFinding({ id: 'c', severity: 'critical', file: 'src/a.ts', line: 30 }),
      makeFinding({ id: 'd', severity: 'critical', file: 'src/a.ts', line: 4 }),
      makeFinding({ id: 'e', severity: 'medium', file: 'src/a.ts', line: 1 }),
    ];
    expect(sortSecurityFindings(findings).map((f) => f.id)).toEqual(['d', 'c', 'b', 'e', 'a']);
  });

  it('sorts repository-wide findings before any file, and a missing line first', () => {
    const findings = [
      makeFinding({ id: 'file', severity: 'high', file: 'src/a.ts', line: 2 }),
      makeFinding({ id: 'no-file', severity: 'high', file: null, line: null }),
      makeFinding({ id: 'no-line', severity: 'high', file: 'src/a.ts', line: null }),
    ];
    // A null file compares as '' and a null line as 0, which is the order the report renders.
    expect(sortSecurityFindings(findings).map((f) => f.id)).toEqual(['no-file', 'no-line', 'file']);
  });

  it('does not mutate the array it was given', () => {
    const findings = [
      makeFinding({ id: 'low', severity: 'low' }),
      makeFinding({ id: 'critical', severity: 'critical' }),
    ];
    sortSecurityFindings(findings);
    expect(findings.map((f) => f.id)).toEqual(['low', 'critical']);
  });
});
