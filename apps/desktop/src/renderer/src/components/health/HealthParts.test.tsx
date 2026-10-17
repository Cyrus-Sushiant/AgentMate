import { screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { HealthPulseHeader } from './HealthPulseHeader';
import { HealthStatusChip } from './HealthStatusChip';
import { type HealthStatusFilter, summarizeHealth } from './healthView';
import { samples, target } from './testing/fixtures';
import { UptimeStrip } from './UptimeStrip';

describe('HealthStatusChip', () => {
  it('says the state in words next to its dot', () => {
    renderWithProviders(<HealthStatusChip state="unreachable" />);
    const chip = screen.getByText('Unreachable');
    expect(chip.closest('span')?.className).toMatch(/text-destructive/);
  });
});

describe('UptimeStrip', () => {
  it('draws one bar per slot, padding the start until there are enough samples', () => {
    renderWithProviders(<UptimeStrip samples={samples(['pass', 'fail', 'warn'])} slots={10} />);
    expect(screen.getAllByTestId('uptime-bar')).toHaveLength(3);
    expect(screen.getAllByTestId('uptime-empty')).toHaveLength(7);
  });

  it('keeps only the newest samples when there are more than slots', () => {
    const many = samples(Array.from({ length: 60 }, () => 'pass' as const));
    renderWithProviders(<UptimeStrip samples={many} />);
    expect(screen.getAllByTestId('uptime-bar')).toHaveLength(50);
  });

  it('sums the strip up for a screen reader', () => {
    renderWithProviders(<UptimeStrip samples={samples(['pass', 'pass', 'fail', 'warn'])} />);
    expect(
      screen.getByRole('img', { name: 'Last 4 checks: 2 healthy, 1 degraded, 1 with a problem' }),
    ).toBeInTheDocument();
  });

  it('explains each bar in a styled tooltip, never a native title', async () => {
    const { user, container } = renderWithProviders(
      <UptimeStrip samples={samples(['pass', 'unreachable'])} />,
    );
    expect(container.querySelector('[title]')).toBeNull();
    const bars = screen.getAllByTestId('uptime-bar');
    await user.hover(bars[1]);
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Unreachable');
    expect(tip).toHaveTextContent('101 ms');
  });
});

describe('HealthPulseHeader', () => {
  const summary = summarizeHealth([
    target({ id: 'a', state: 'pass', uptime24h: 1 }),
    target({ id: 'b', state: 'fail', uptime24h: 0.9 }),
    target({ id: 'c', state: 'paused', uptime24h: null }),
  ]);

  it('shows the overall uptime and each count with its label', () => {
    renderWithProviders(<HealthPulseHeader summary={summary} loading={false} />);
    const header = screen.getByRole('region', { name: 'Health overview' });
    expect(within(header).getByText('95.0%')).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /Healthy, 1/ })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /Down, 1/ })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /Paused or locked, 1/ })).toBeInTheDocument();
  });

  it('filters by a bucket when its count is clicked, and clears on a second click', async () => {
    const onSelect = vi.fn();
    function Harness() {
      const [active, setActive] = useState<HealthStatusFilter>('all');
      return (
        <HealthPulseHeader
          summary={summary}
          loading={false}
          active={active}
          onSelect={(next) => {
            onSelect(next);
            setActive(next);
          }}
        />
      );
    }
    const { user } = renderWithProviders(<Harness />);
    const down = screen.getByRole('button', { name: /Down, 1/ });
    await user.click(down);
    expect(onSelect).toHaveBeenCalledWith('down');
    expect(down).toHaveAttribute('aria-pressed', 'true');
    await user.click(down);
    expect(onSelect).toHaveBeenLastCalledWith('all');
  });

  it('shimmers the numbers while the first list loads', () => {
    renderWithProviders(<HealthPulseHeader summary={summarizeHealth([])} loading />);
    expect(screen.queryByText('No data')).toBeNull();
    expect(screen.getByRole('region', { name: 'Health overview' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});
