// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { share, TOKEN_KINDS, TokenLegend, TokenShareBar } from './TokenSplit';

/**
 * The split of a conversation's or a project's tokens into the four kinds the logs record. The
 * right-click menu on a history row and the project Usage tab both draw it.
 */

const tokens = { input: 50, output: 25, cacheRead: 25, cacheWrite: 0, total: 100 };
const colors = ['#111111', '#222222', '#333333', '#444444'];

describe('share', () => {
  it('rounds to a whole percent', () => {
    expect(share(1, 3)).toBe('33%');
    expect(share(2, 3)).toBe('67%');
  });

  it('keeps a sliver visible instead of rounding it away', () => {
    expect(share(1, 1000)).toBe('<1%');
  });

  it('is zero for nothing used, however the total looks', () => {
    expect(share(0, 100)).toBe('0%');
    expect(share(5, 0)).toBe('0%');
  });
});

describe('TokenShareBar', () => {
  it('describes the split for a screen reader', () => {
    render(<TokenShareBar tokens={tokens} colors={colors} />);

    expect(screen.getByRole('img', { name: /Token split/ })).toHaveAccessibleName(
      'Token split: Input 50%, Output 25%, Cache read 25%, Cache write 0%',
    );
  });

  it('draws a segment per kind that was used, and none for the rest', () => {
    const { container } = render(<TokenShareBar tokens={tokens} colors={colors} />);

    expect(container.querySelectorAll('[role="img"] > span')).toHaveLength(3);
  });

  it('takes the layout from the caller', () => {
    render(<TokenShareBar tokens={tokens} colors={colors} className="mx-4" />);

    expect(screen.getByRole('img')).toHaveClass('mx-4');
  });
});

describe('TokenLegend', () => {
  it('lists the four kinds with their tokens and share', () => {
    render(<TokenLegend tokens={tokens} colors={colors} />);

    for (const kind of TOKEN_KINDS) expect(screen.getByText(kind.label)).toBeInTheDocument();
    expect(screen.getByText('Input').closest('div')).toHaveTextContent('Input5050%');
    expect(screen.getByText('Cache write').closest('div')).toHaveTextContent('Cache write00%');
  });
});
