const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * A dollar amount for the Usage tab: grouped, to the cent, and `<$0.01` for a spend too small to
 * show. Null (no known price) has no amount. It lives here rather than in the shared formatCost
 * so a total in the thousands reads as $3,336.03 without changing the other Token Usage cards.
 */
export function formatMoney(cost: number | null): string | null {
  if (cost === null) return null;
  if (cost > 0 && cost < 0.005) return '<$0.01';
  return dollars.format(cost);
}
