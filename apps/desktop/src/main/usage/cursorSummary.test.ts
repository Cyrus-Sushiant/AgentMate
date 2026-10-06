import { describe, expect, it } from 'vitest';
import { cursorPlanLimits } from './cursorSummary';

/**
 * A usage-based Cursor plan reports its limits as shares of the included usage spent this
 * billing cycle. The fixture is the shape a Pro+ account answers with: the plan is spent past
 * its included amount (bonus usage covers the rest), so the dashboard's total reads 67% while
 * the API half is at 100%.
 */

const PRO_PLUS = {
  billingCycleStart: '2026-09-22T11:34:38.000Z',
  billingCycleEnd: '2026-10-22T11:34:38.000Z',
  membershipType: 'pro_plus',
  limitType: 'user',
  isUnlimited: false,
  individualUsage: {
    plan: {
      enabled: true,
      used: 7000,
      limit: 7000,
      remaining: 0,
      breakdown: { included: 7000, bonus: 75815, total: 82815 },
      autoPercentUsed: 66.685,
      apiPercentUsed: 100,
      totalPercentUsed: 67.4663951120163,
    },
    onDemand: { enabled: false, used: 0, limit: null, remaining: null },
  },
  teamUsage: {},
};

const RESET = '2026-10-22T11:34:38.000Z';

describe('cursorPlanLimits', () => {
  it('leads with the total share used, then the Auto and API halves', () => {
    const limits = cursorPlanLimits(PRO_PLUS);

    expect(limits?.windows).toEqual([
      { key: 'month', label: 'Monthly usage', percent: 67.4663951120163, resetAt: RESET },
      { key: 'month-auto', label: 'Auto', percent: 66.685, resetAt: RESET },
      { key: 'month-api', label: 'API', percent: 100, resetAt: RESET },
    ]);
    expect(limits?.window).toEqual({
      label: 'Plan usage',
      used: 67,
      total: 100,
      percent: 67.4663951120163,
      resetAt: RESET,
    });
  });

  it('keeps only the total when the plan does not split it', () => {
    const plan = { enabled: true, totalPercentUsed: 12 };
    const limits = cursorPlanLimits({ ...PRO_PLUS, individualUsage: { plan } });

    expect(limits?.windows.map((w) => w.key)).toEqual(['month']);
  });

  it('has nothing to show for an unlimited or disabled plan', () => {
    expect(cursorPlanLimits({ ...PRO_PLUS, isUnlimited: true })).toBeNull();
    expect(
      cursorPlanLimits({ ...PRO_PLUS, individualUsage: { plan: { enabled: false } } }),
    ).toBeNull();
  });

  it('has nothing to show for an answer it does not recognize', () => {
    expect(cursorPlanLimits(null)).toBeNull();
    expect(cursorPlanLimits({ gpt4: { numRequests: 3 } })).toBeNull();
    expect(
      cursorPlanLimits({ individualUsage: { plan: { totalPercentUsed: 'lots' } } }),
    ).toBeNull();
  });

  it('keeps a share inside 0 to 100 and allows a missing cycle end', () => {
    const plan = { enabled: true, totalPercentUsed: 140 };
    const limits = cursorPlanLimits({ individualUsage: { plan } });

    expect(limits?.windows).toEqual([
      { key: 'month', label: 'Monthly usage', percent: 100, resetAt: null },
    ]);
  });
});
