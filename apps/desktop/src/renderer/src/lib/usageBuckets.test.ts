import type { ProjectUsageDay } from '@shared/apiTypes';
import { describe, expect, it } from 'vitest';
import {
  barRangeLabel,
  barValue,
  buildChart,
  formatDayLabel,
  hasCost,
  peakIndex,
} from './usageBuckets';

/**
 * The bars of a project's spend chart: every day of the period gets a bar, quiet ones included,
 * and a long period is summed into weeks so the bars stay wide enough to hover.
 */

const TODAY = new Date(2026, 8, 20, 15);

const spend = (day: string, tokens: number, costUsd: number | null = null): ProjectUsageDay => ({
  day,
  tokens,
  costUsd,
});

describe('buildChart for a fixed period', () => {
  it('has a bar for every day, today last, with quiet days at zero', () => {
    const { grain, bars } = buildChart(
      [spend('2026-09-15', 100, 1.5), spend('2026-09-20', 40, 0.5)],
      7,
      TODAY,
    );

    expect(grain).toBe('day');
    expect(bars.map((b) => b.from)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]);
    expect(bars[1]).toEqual({ from: '2026-09-15', to: '2026-09-15', tokens: 100, costUsd: 1.5 });
    expect(bars[0]).toEqual({ from: '2026-09-14', to: '2026-09-14', tokens: 0, costUsd: null });
  });

  it('leaves out days before the period', () => {
    const { bars } = buildChart([spend('2026-09-01', 999, 9)], 7, TODAY);

    expect(bars.reduce((n, b) => n + b.tokens, 0)).toBe(0);
  });

  it('counts exactly the days asked for, whatever clocks did in between', () => {
    // A daylight saving change must not add or drop a bar.
    const { bars } = buildChart([], 40, new Date(2026, 2, 31, 12));

    expect(bars).toHaveLength(40);
    expect(bars[bars.length - 1].from).toBe('2026-03-31');
  });
});

describe('buildChart for all time', () => {
  it('runs from the first day with spend to today', () => {
    const { bars } = buildChart([spend('2026-09-18', 5), spend('2026-09-19', 6)], null, TODAY);

    expect(bars.map((b) => b.from)).toEqual(['2026-09-18', '2026-09-19', '2026-09-20']);
  });

  it('is one bar when the only spend is today', () => {
    const { bars } = buildChart([spend('2026-09-20', 5)], null, TODAY);

    expect(bars).toHaveLength(1);
  });

  it('is empty when nothing was ever spent', () => {
    expect(buildChart([], null, TODAY)).toEqual({ grain: 'day', bars: [] });
  });
});

describe('buildChart weekly grain', () => {
  const longAgo = new Date(2026, 8, 20 - 99, 12);
  const first = `${longAgo.getFullYear()}-${String(longAgo.getMonth() + 1).padStart(2, '0')}-${String(longAgo.getDate()).padStart(2, '0')}`;

  it('sums a long period into weeks from its first day, the last one short', () => {
    const { grain, bars } = buildChart(
      [spend(first, 10, 1), spend('2026-09-20', 5, 0.25)],
      null,
      TODAY,
    );

    expect(grain).toBe('week');
    // 100 days from the first spend to today: fourteen full weeks and two days.
    expect(bars).toHaveLength(15);
    expect(bars[0].from).toBe(first);
    expect(bars[0].tokens).toBe(10);
    expect(bars[bars.length - 1]).toMatchObject({ to: '2026-09-20', tokens: 5, costUsd: 0.25 });
  });

  it('adds the days of a week and keeps it unpriced when none of them is priced', () => {
    const { bars } = buildChart([spend(first, 10), spend('2026-09-20', 5)], null, TODAY);

    expect(bars[0].costUsd).toBeNull();
    const priced = buildChart([spend(first, 10, 1), spend(addDays(first, 2), 30, 2)], null, TODAY);
    expect(priced.bars[0]).toMatchObject({ tokens: 40, costUsd: 3 });
  });

  it('stays daily up to a little over two months', () => {
    const sixty = buildChart([], 60, TODAY);
    const ninety = buildChart([], 90, TODAY);

    expect(sixty.grain).toBe('day');
    expect(ninety.grain).toBe('week');
  });
});

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const next = new Date(y, m - 1, d + n);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

describe('bar values', () => {
  const bars = [
    { from: 'a', to: 'a', tokens: 10, costUsd: 0.5 },
    { from: 'b', to: 'b', tokens: 90, costUsd: null },
    { from: 'c', to: 'c', tokens: 30, costUsd: 2 },
  ];

  it('reads cost or tokens, an unpriced day counting as no cost', () => {
    expect(bars.map((b) => barValue(b, 'cost'))).toEqual([0.5, 0, 2]);
    expect(bars.map((b) => barValue(b, 'tokens'))).toEqual([10, 90, 30]);
  });

  it('finds the biggest bar, or none when everything is zero', () => {
    expect(peakIndex(bars, 'cost')).toBe(2);
    expect(peakIndex(bars, 'tokens')).toBe(1);
    expect(peakIndex([{ from: 'a', to: 'a', tokens: 0, costUsd: null }], 'tokens')).toBeNull();
    expect(peakIndex([], 'cost')).toBeNull();
  });

  it('knows whether any day has a cost to draw', () => {
    expect(hasCost([spend('2026-09-01', 5), spend('2026-09-02', 5, 0)])).toBe(true);
    expect(hasCost([spend('2026-09-01', 5)])).toBe(false);
    expect(hasCost([])).toBe(false);
  });
});

describe('labels', () => {
  it('names a day by month and day', () => {
    expect(formatDayLabel('2026-09-07')).toBe('Sep 7');
  });

  it('names a day alone, and a week by its first and last day', () => {
    expect(barRangeLabel({ from: '2026-09-07', to: '2026-09-07', tokens: 0, costUsd: null })).toBe(
      'Sep 7',
    );
    expect(barRangeLabel({ from: '2026-09-07', to: '2026-09-13', tokens: 0, costUsd: null })).toBe(
      'Sep 7 to Sep 13',
    );
  });
});
